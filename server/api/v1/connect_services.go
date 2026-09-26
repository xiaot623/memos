package v1

import (
	"context"

	"connectrpc.com/connect"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// This file contains all Connect service handler method implementations.
// Each method delegates to the underlying gRPC service implementation,
// converting between Connect and gRPC request/response types.

func (s *ConnectServiceHandler) GetInstanceProfile(ctx context.Context, req *connect.Request[v1pb.GetInstanceProfileRequest]) (*connect.Response[v1pb.InstanceProfile], error) {
	resp, err := s.APIV1Service.GetInstanceProfile(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetInstanceSetting(ctx context.Context, req *connect.Request[v1pb.GetInstanceSettingRequest]) (*connect.Response[v1pb.InstanceSetting], error) {
	resp, err := s.APIV1Service.GetInstanceSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchGetInstanceSettings(ctx context.Context, req *connect.Request[v1pb.BatchGetInstanceSettingsRequest]) (*connect.Response[v1pb.BatchGetInstanceSettingsResponse], error) {
	resp, err := s.APIV1Service.BatchGetInstanceSettings(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateInstanceSetting(ctx context.Context, req *connect.Request[v1pb.UpdateInstanceSettingRequest]) (*connect.Response[v1pb.InstanceSetting], error) {
	resp, err := s.APIV1Service.UpdateInstanceSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetInstanceStats(ctx context.Context, req *connect.Request[v1pb.GetInstanceStatsRequest]) (*connect.Response[v1pb.InstanceStats], error) {
	resp, err := s.APIV1Service.GetInstanceStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AuthService
//
// Auth service methods need special handling for response headers (cookies).
// We use connectWithHeaderCarrier helper to inject a header carrier into the context,
// which allows the service to set headers in a protocol-agnostic way.

func (s *ConnectServiceHandler) GetCurrentUser(ctx context.Context, req *connect.Request[v1pb.GetCurrentUserRequest]) (*connect.Response[v1pb.GetCurrentUserResponse], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*v1pb.GetCurrentUserResponse, error) {
		return s.APIV1Service.GetCurrentUser(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) SignIn(ctx context.Context, req *connect.Request[v1pb.SignInRequest]) (*connect.Response[v1pb.SignInResponse], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*v1pb.SignInResponse, error) {
		return s.APIV1Service.SignIn(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) SignOut(ctx context.Context, req *connect.Request[v1pb.SignOutRequest]) (*connect.Response[emptypb.Empty], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*emptypb.Empty, error) {
		return s.APIV1Service.SignOut(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) RefreshToken(ctx context.Context, req *connect.Request[v1pb.RefreshTokenRequest]) (*connect.Response[v1pb.RefreshTokenResponse], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*v1pb.RefreshTokenResponse, error) {
		return s.APIV1Service.RefreshToken(ctx, req.Msg)
	})
}

// UserService

func (s *ConnectServiceHandler) ListUsers(ctx context.Context, req *connect.Request[v1pb.ListUsersRequest]) (*connect.Response[v1pb.ListUsersResponse], error) {
	resp, err := s.APIV1Service.ListUsers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchGetUsers(ctx context.Context, req *connect.Request[v1pb.BatchGetUsersRequest]) (*connect.Response[v1pb.BatchGetUsersResponse], error) {
	resp, err := s.APIV1Service.BatchGetUsers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUser(ctx context.Context, req *connect.Request[v1pb.GetUserRequest]) (*connect.Response[v1pb.User], error) {
	resp, err := s.APIV1Service.GetUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateUser(ctx context.Context, req *connect.Request[v1pb.CreateUserRequest]) (*connect.Response[v1pb.User], error) {
	resp, err := s.APIV1Service.CreateUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUser(ctx context.Context, req *connect.Request[v1pb.UpdateUserRequest]) (*connect.Response[v1pb.User], error) {
	resp, err := s.APIV1Service.UpdateUser(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteUser(ctx context.Context, req *connect.Request[v1pb.DeleteUserRequest]) (*connect.Response[emptypb.Empty], error) {
	return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*emptypb.Empty, error) {
		return s.APIV1Service.DeleteUser(ctx, req.Msg)
	})
}

func (s *ConnectServiceHandler) ListAllUserStats(ctx context.Context, req *connect.Request[v1pb.ListAllUserStatsRequest]) (*connect.Response[v1pb.ListAllUserStatsResponse], error) {
	resp, err := s.APIV1Service.ListAllUserStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserStats(ctx context.Context, req *connect.Request[v1pb.GetUserStatsRequest]) (*connect.Response[v1pb.UserStats], error) {
	resp, err := s.APIV1Service.GetUserStats(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ExportMemos(ctx context.Context, req *connect.Request[v1pb.ExportMemosRequest]) (*connect.Response[httpbody.HttpBody], error) {
	resp, err := s.APIV1Service.ExportMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ImportMemos(ctx context.Context, req *connect.Request[v1pb.ImportMemosRequest]) (*connect.Response[v1pb.ImportMemosResponse], error) {
	resp, err := s.APIV1Service.ImportMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetUserSetting(ctx context.Context, req *connect.Request[v1pb.GetUserSettingRequest]) (*connect.Response[v1pb.UserSetting], error) {
	resp, err := s.APIV1Service.GetUserSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateUserSetting(ctx context.Context, req *connect.Request[v1pb.UpdateUserSettingRequest]) (*connect.Response[v1pb.UserSetting], error) {
	resp, err := s.APIV1Service.UpdateUserSetting(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserSettings(ctx context.Context, req *connect.Request[v1pb.ListUserSettingsRequest]) (*connect.Response[v1pb.ListUserSettingsResponse], error) {
	resp, err := s.APIV1Service.ListUserSettings(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListPersonalAccessTokens(ctx context.Context, req *connect.Request[v1pb.ListPersonalAccessTokensRequest]) (*connect.Response[v1pb.ListPersonalAccessTokensResponse], error) {
	resp, err := s.APIV1Service.ListPersonalAccessTokens(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreatePersonalAccessToken(ctx context.Context, req *connect.Request[v1pb.CreatePersonalAccessTokenRequest]) (*connect.Response[v1pb.CreatePersonalAccessTokenResponse], error) {
	resp, err := s.APIV1Service.CreatePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeletePersonalAccessToken(ctx context.Context, req *connect.Request[v1pb.DeletePersonalAccessTokenRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeletePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateMemo(ctx context.Context, req *connect.Request[v1pb.CreateMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.CreateMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemos(ctx context.Context, req *connect.Request[v1pb.ListMemosRequest]) (*connect.Response[v1pb.ListMemosResponse], error) {
	resp, err := s.APIV1Service.ListMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) SearchMemos(ctx context.Context, req *connect.Request[v1pb.SearchMemosRequest]) (*connect.Response[v1pb.SearchMemosResponse], error) {
	resp, err := s.APIV1Service.SearchMemos(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetMemo(ctx context.Context, req *connect.Request[v1pb.GetMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.GetMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateMemo(ctx context.Context, req *connect.Request[v1pb.UpdateMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.UpdateMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemo(ctx context.Context, req *connect.Request[v1pb.DeleteMemoRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) SetMemoAttachments(ctx context.Context, req *connect.Request[v1pb.SetMemoAttachmentsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.SetMemoAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoAttachments(ctx context.Context, req *connect.Request[v1pb.ListMemoAttachmentsRequest]) (*connect.Response[v1pb.ListMemoAttachmentsResponse], error) {
	resp, err := s.APIV1Service.ListMemoAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoReactions(ctx context.Context, req *connect.Request[v1pb.ListMemoReactionsRequest]) (*connect.Response[v1pb.ListMemoReactionsResponse], error) {
	resp, err := s.APIV1Service.ListMemoReactions(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpsertMemoReaction(ctx context.Context, req *connect.Request[v1pb.UpsertMemoReactionRequest]) (*connect.Response[v1pb.Reaction], error) {
	resp, err := s.APIV1Service.UpsertMemoReaction(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemoReaction(ctx context.Context, req *connect.Request[v1pb.DeleteMemoReactionRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteMemoReaction(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateMemoShare(ctx context.Context, req *connect.Request[v1pb.CreateMemoShareRequest]) (*connect.Response[v1pb.MemoShare], error) {
	resp, err := s.APIV1Service.CreateMemoShare(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListMemoShares(ctx context.Context, req *connect.Request[v1pb.ListMemoSharesRequest]) (*connect.Response[v1pb.ListMemoSharesResponse], error) {
	resp, err := s.APIV1Service.ListMemoShares(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteMemoShare(ctx context.Context, req *connect.Request[v1pb.DeleteMemoShareRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteMemoShare(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSharedMemo(ctx context.Context, req *connect.Request[v1pb.GetSharedMemoRequest]) (*connect.Response[v1pb.Memo], error) {
	resp, err := s.APIV1Service.GetSharedMemo(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateSpace(ctx context.Context, req *connect.Request[v1pb.CreateSpaceRequest]) (*connect.Response[v1pb.Space], error) {
	resp, err := s.APIV1Service.CreateSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListSpaces(ctx context.Context, req *connect.Request[v1pb.ListSpacesRequest]) (*connect.Response[v1pb.ListSpacesResponse], error) {
	resp, err := s.APIV1Service.ListSpaces(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSpace(ctx context.Context, req *connect.Request[v1pb.GetSpaceRequest]) (*connect.Response[v1pb.Space], error) {
	resp, err := s.APIV1Service.GetSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateSpace(ctx context.Context, req *connect.Request[v1pb.UpdateSpaceRequest]) (*connect.Response[v1pb.Space], error) {
	resp, err := s.APIV1Service.UpdateSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteSpace(ctx context.Context, req *connect.Request[v1pb.DeleteSpaceRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteSpace(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateSpaceInvitation(ctx context.Context, req *connect.Request[v1pb.CreateSpaceInvitationRequest]) (*connect.Response[v1pb.SpaceInvitation], error) {
	resp, err := s.APIV1Service.CreateSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListSpaceInvitations(ctx context.Context, req *connect.Request[v1pb.ListSpaceInvitationsRequest]) (*connect.Response[v1pb.ListSpaceInvitationsResponse], error) {
	resp, err := s.APIV1Service.ListSpaceInvitations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListUserSpaceInvitations(ctx context.Context, req *connect.Request[v1pb.ListUserSpaceInvitationsRequest]) (*connect.Response[v1pb.ListUserSpaceInvitationsResponse], error) {
	resp, err := s.APIV1Service.ListUserSpaceInvitations(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSpaceInvitation(ctx context.Context, req *connect.Request[v1pb.GetSpaceInvitationRequest]) (*connect.Response[v1pb.SpaceInvitation], error) {
	resp, err := s.APIV1Service.GetSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteSpaceInvitation(ctx context.Context, req *connect.Request[v1pb.DeleteSpaceInvitationRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) AcceptSpaceInvitation(ctx context.Context, req *connect.Request[v1pb.AcceptSpaceInvitationRequest]) (*connect.Response[v1pb.SpaceMember], error) {
	resp, err := s.APIV1Service.AcceptSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeclineSpaceInvitation(ctx context.Context, req *connect.Request[v1pb.DeclineSpaceInvitationRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeclineSpaceInvitation(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListSpaceMembers(ctx context.Context, req *connect.Request[v1pb.ListSpaceMembersRequest]) (*connect.Response[v1pb.ListSpaceMembersResponse], error) {
	resp, err := s.APIV1Service.ListSpaceMembers(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetSpaceMember(ctx context.Context, req *connect.Request[v1pb.GetSpaceMemberRequest]) (*connect.Response[v1pb.SpaceMember], error) {
	resp, err := s.APIV1Service.GetSpaceMember(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateSpaceMember(ctx context.Context, req *connect.Request[v1pb.UpdateSpaceMemberRequest]) (*connect.Response[v1pb.SpaceMember], error) {
	resp, err := s.APIV1Service.UpdateSpaceMember(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteSpaceMember(ctx context.Context, req *connect.Request[v1pb.DeleteSpaceMemberRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteSpaceMember(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AttachmentService

func (s *ConnectServiceHandler) UploadAttachment(ctx context.Context, req *connect.Request[v1pb.UploadAttachmentRequest]) (*connect.Response[v1pb.UploadAttachmentResponse], error) {
	resp, err := s.APIV1Service.UploadAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateAttachment(ctx context.Context, req *connect.Request[v1pb.CreateAttachmentRequest]) (*connect.Response[v1pb.Attachment], error) {
	resp, err := s.APIV1Service.CreateAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) ListAttachments(ctx context.Context, req *connect.Request[v1pb.ListAttachmentsRequest]) (*connect.Response[v1pb.ListAttachmentsResponse], error) {
	resp, err := s.APIV1Service.ListAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetAttachment(ctx context.Context, req *connect.Request[v1pb.GetAttachmentRequest]) (*connect.Response[v1pb.Attachment], error) {
	resp, err := s.APIV1Service.GetAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateAttachment(ctx context.Context, req *connect.Request[v1pb.UpdateAttachmentRequest]) (*connect.Response[v1pb.Attachment], error) {
	resp, err := s.APIV1Service.UpdateAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteAttachment(ctx context.Context, req *connect.Request[v1pb.DeleteAttachmentRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.DeleteAttachment(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) BatchDeleteAttachments(ctx context.Context, req *connect.Request[v1pb.BatchDeleteAttachmentsRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIV1Service.BatchDeleteAttachments(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// AIService

func (s *ConnectServiceHandler) ListEmbeddingModels(ctx context.Context, req *connect.Request[v1pb.ListEmbeddingModelsRequest]) (*connect.Response[v1pb.ListEmbeddingModelsResponse], error) {
	resp, err := s.APIV1Service.ListEmbeddingModels(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}
