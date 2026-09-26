package v1

import (
	"context"

	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/clientip"
	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	unmatchedUsernameAndPasswordError = "unmatched username and password"
)

// GetCurrentUser returns the authenticated user's information.
// Validates the access token and returns user details.
//
// Authentication: Required (access token).
// Returns: User information.
func (s *APIV1Service) GetCurrentUser(ctx context.Context, _ *v1pb.GetCurrentUserRequest) (*v1pb.GetCurrentUserResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		// Clear auth cookies
		if err := s.clearAuthCookies(ctx); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to clear auth cookies: %v", err)
		}
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	return &v1pb.GetCurrentUserResponse{
		User: convertUserFromStore(user, user),
	}, nil
}

// SignIn authenticates a user with credentials and returns tokens.
// On success, returns an access token and sets a refresh token cookie.
//
// Supports two authentication methods:
// 1. Password-based authentication (username + password).
// 2. SSO authentication (OAuth2 authorization code).
//
// Authentication: Not required (public endpoint).
// Returns: User info, access token, and token expiry.
func (s *APIV1Service) SignIn(ctx context.Context, request *v1pb.SignInRequest) (*v1pb.SignInResponse, error) {
	var existingUser *store.User

	// Rate limits run before any lookup or hashing so a flood costs nothing.
	// Each attempt reserves its units up front, so concurrent attempts cannot
	// share one remaining unit; a successful attempt gives them back below.
	// The account key is the submitted name whether or not it exists, so the
	// limit cannot be used to learn which accounts are real.
	clientIP := clientip.FromContext(ctx)
	attempt, err := s.reserveSignIn(clientIP, request.GetPasswordCredentials().GetUsername())
	if err != nil {
		return nil, err
	}

	// Authentication Method 1: Password-based authentication
	if passwordCredentials := request.GetPasswordCredentials(); passwordCredentials != nil {
		if err := s.requireChallenge(ctx, ratelimit.ScopeSignInIP); err != nil {
			attempt.succeeded()
			return nil, err
		}
		user, err := s.Store.GetUser(ctx, &store.FindUser{
			Username: &passwordCredentials.Username,
		})
		if err != nil {
			attempt.succeeded()
			return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
		}
		// Compare the stored hashed password, with the hashed version of the password that was received.
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(passwordCredentials.Password)); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
		}
		// The password matched: from here on the attempt is not a guess.
		attempt.succeeded()
		instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
		}
		// Check if the password auth in is allowed.
		if instanceGeneralSetting.DisallowPasswordAuth && user.Role == store.RoleUser {
			return nil, status.Errorf(codes.PermissionDenied, "password signin is not allowed")
		}
		existingUser = user
	}

	if existingUser == nil {
		// No credential was presented at all; nothing to guess against.
		attempt.succeeded()
		return nil, status.Errorf(codes.InvalidArgument, "invalid credentials")
	}
	// The credential has been proven from here on; the attempt does not count.
	attempt.succeeded()
	if existingUser.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, "user has been archived with username %s", existingUser.Username)
	}

	accessToken, accessExpiresAt, err := s.doSignIn(ctx, existingUser)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in: %v", err)
	}

	return &v1pb.SignInResponse{
		User:                 convertUserFromStore(existingUser, existingUser),
		AccessToken:          accessToken,
		AccessTokenExpiresAt: timestamppb.New(accessExpiresAt),
	}, nil
}
