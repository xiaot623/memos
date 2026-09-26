package test

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestUserSettingStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "en"}},
	})
	require.NoError(t, err)
	list, err := ts.ListUserSettings(ctx, &store.FindUserSetting{})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))
	ts.Close()
}

func TestUserSettingUpsertUpdate(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create initial setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "en"}},
	})
	require.NoError(t, err)

	// Update setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "fr"}},
	})
	require.NoError(t, err)

	// Verify update
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	require.NoError(t, err)
	require.Equal(t, "fr", setting.GetGeneral().Locale)

	// Verify only one setting exists
	list, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &user.ID})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))

	ts.Close()
}

func TestUserSettingRefreshTokens(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Initially no tokens
	tokens, err := ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, tokens)

	// Add a refresh token
	token1 := &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:     "token-1",
		Description: "Chrome browser session",
	}
	err = ts.AddUserRefreshToken(ctx, user.ID, token1)
	require.NoError(t, err)

	// Verify token was added
	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 1)
	require.Equal(t, "token-1", tokens[0].TokenId)

	// Add another token
	token2 := &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:     "token-2",
		Description: "Firefox browser session",
	}
	err = ts.AddUserRefreshToken(ctx, user.ID, token2)
	require.NoError(t, err)

	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 2)

	// Get specific token by ID
	foundToken, err := ts.GetUserRefreshTokenByID(ctx, user.ID, "token-1")
	require.NoError(t, err)
	require.NotNil(t, foundToken)
	require.Equal(t, "Chrome browser session", foundToken.Description)

	// Get non-existent token
	notFound, err := ts.GetUserRefreshTokenByID(ctx, user.ID, "non-existent")
	require.NoError(t, err)
	require.Nil(t, notFound)

	// Remove token
	err = ts.RemoveUserRefreshToken(ctx, user.ID, "token-1")
	require.NoError(t, err)

	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 1)
	require.Equal(t, "token-2", tokens[0].TokenId)

	ts.Close()
}

func TestUserSettingRefreshTokensConcurrentAdds(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	const tokenCount = 16
	start := make(chan struct{})
	errCh := make(chan error, tokenCount)
	var wg sync.WaitGroup
	for i := range tokenCount {
		tokenID := strconv.Itoa(i)
		wg.Go(func() {
			<-start
			errCh <- ts.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{TokenId: tokenID})
		})
	}
	close(start)
	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}

	tokens, err := ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, tokenCount)
	seen := make(map[string]bool, tokenCount)
	for _, token := range tokens {
		require.False(t, seen[token.TokenId], "duplicate token %q", token.TokenId)
		seen[token.TokenId] = true
	}
}

func TestUserSettingPersonalAccessTokens(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Initially no PATs
	pats, err := ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, pats)

	// Add a PAT
	pat1 := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-1",
		TokenHash:   "pat-hash-1",
		Description: "API Token for external access",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat1)
	require.NoError(t, err)

	// Verify PAT was added
	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 1)
	require.Equal(t, "API Token for external access", pats[0].Description)

	// Add another PAT
	pat2 := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-2",
		TokenHash:   "pat-hash-2",
		Description: "CI Token",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat2)
	require.NoError(t, err)

	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 2)

	// Remove PAT
	err = ts.RemoveUserPersonalAccessToken(ctx, user.ID, "pat-1")
	require.NoError(t, err)

	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 1)
	require.Equal(t, "pat-2", pats[0].TokenId)

	ts.Close()
}

func TestUserSettingGetUserByPATHash(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT with a known hash
	patHash := "test-pat-hash-12345"
	pat := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-test-1",
		TokenHash:   patHash,
		Description: "Test PAT for lookup",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat)
	require.NoError(t, err)

	// Lookup user by PAT hash
	result, err := ts.GetUserByPATHash(ctx, patHash)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, user.ID, result.UserID)
	require.NotNil(t, result.User)
	require.Equal(t, user.Username, result.User.Username)
	require.NotNil(t, result.PAT)
	require.Equal(t, "pat-test-1", result.PAT.TokenId)
	require.Equal(t, "Test PAT for lookup", result.PAT.Description)

	ts.Close()
}

func TestUserSettingGetUserByPATHashNotFound(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Lookup non-existent PAT hash
	result, err := ts.GetUserByPATHash(ctx, "non-existent-hash")
	require.Error(t, err)
	require.Nil(t, result)

	ts.Close()
}

func TestUserSettingGetUserByPATHashNoTokensKey(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// User exists but has no PERSONAL_ACCESS_TOKENS key at all
	// This simulates fresh users or users upgraded from v0.25.3
	result, err := ts.GetUserByPATHash(ctx, "any-hash")
	require.Error(t, err)
	require.Nil(t, result)
	// Error could be "PAT not found" (Postgres) or "sql: no rows in result set" (SQLite/MySQL)
	require.True(t,
		strings.Contains(err.Error(), "PAT not found") || strings.Contains(err.Error(), "no rows"),
		"expected PAT not found or no rows error, got: %v", err)

	// Now add a PAT for the user
	pat := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-new",
		TokenHash:   "hash-new",
		Description: "New PAT",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat)
	require.NoError(t, err)

	// Now the lookup should succeed
	result, err = ts.GetUserByPATHash(ctx, "hash-new")
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, user.ID, result.UserID)

	ts.Close()
}

func TestUserSettingGetUserByPATHashEmptyTokensArray(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Add a PAT setting with empty tokens array
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
		Value: &storepb.UserSetting_PersonalAccessTokens{
			PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
				Tokens: []*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{},
			},
		},
	})
	require.NoError(t, err)

	// Lookup should fail gracefully, not crash
	result, err := ts.GetUserByPATHash(ctx, "any-hash")
	require.Error(t, err)
	require.Nil(t, result)
	// Error could be "PAT not found" (Postgres) or "sql: no rows in result set" (SQLite/MySQL)
	require.True(t,
		strings.Contains(err.Error(), "PAT not found") || strings.Contains(err.Error(), "no rows"),
		"expected PAT not found or no rows error, got: %v", err)

	ts.Close()
}

func TestUserSettingGetUserByPATHashWithOtherUsers(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create multiple users - some with PATs, some without
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	user3, err := createTestingUserWithRole(ctx, ts, "user3", store.RoleUser)
	require.NoError(t, err)

	// User1: Has PAT
	pat1Hash := "user1-pat-hash-unique"
	err = ts.AddUserPersonalAccessToken(ctx, user1.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-user1",
		TokenHash:   pat1Hash,
		Description: "User 1 PAT",
	})
	require.NoError(t, err)

	// User2: Has no PERSONAL_ACCESS_TOKENS key (fresh user)
	// User3: Has empty tokens array
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user3.ID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
		Value: &storepb.UserSetting_PersonalAccessTokens{
			PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
				Tokens: []*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{},
			},
		},
	})
	require.NoError(t, err)

	// Should find user1's PAT despite user2 having no key and user3 having empty array
	result, err := ts.GetUserByPATHash(ctx, pat1Hash)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, user1.ID, result.UserID)
	require.Equal(t, "pat-user1", result.PAT.TokenId)

	// Should not find non-existent hash even with mixed user states
	result, err = ts.GetUserByPATHash(ctx, "non-existent")
	require.Error(t, err)
	require.Nil(t, result)

	ts.Close()
}

func TestUserSettingGetUserByPATHashMultipleUsers(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	// Create PATs for both users
	pat1Hash := "user1-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user1.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-user1",
		TokenHash:   pat1Hash,
		Description: "User 1 PAT",
	})
	require.NoError(t, err)

	pat2Hash := "user2-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user2.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-user2",
		TokenHash:   pat2Hash,
		Description: "User 2 PAT",
	})
	require.NoError(t, err)

	// Lookup user1's PAT
	result1, err := ts.GetUserByPATHash(ctx, pat1Hash)
	require.NoError(t, err)
	require.Equal(t, user1.ID, result1.UserID)
	require.Equal(t, user1.Username, result1.User.Username)

	// Lookup user2's PAT
	result2, err := ts.GetUserByPATHash(ctx, pat2Hash)
	require.NoError(t, err)
	require.Equal(t, user2.ID, result2.UserID)
	require.Equal(t, user2.Username, result2.User.Username)

	ts.Close()
}

func TestUserSettingGetUserByPATHashMultiplePATsSameUser(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create multiple PATs for the same user
	pat1Hash := "first-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-1",
		TokenHash:   pat1Hash,
		Description: "First PAT",
	})
	require.NoError(t, err)

	pat2Hash := "second-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-2",
		TokenHash:   pat2Hash,
		Description: "Second PAT",
	})
	require.NoError(t, err)

	// Both PATs should resolve to the same user
	result1, err := ts.GetUserByPATHash(ctx, pat1Hash)
	require.NoError(t, err)
	require.Equal(t, user.ID, result1.UserID)
	require.Equal(t, "pat-1", result1.PAT.TokenId)

	result2, err := ts.GetUserByPATHash(ctx, pat2Hash)
	require.NoError(t, err)
	require.Equal(t, user.ID, result2.UserID)
	require.Equal(t, "pat-2", result2.PAT.TokenId)

	ts.Close()
}

func TestUserSettingUpdatePATLastUsed(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT
	patHash := "pat-hash-for-update"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-update-test",
		TokenHash:   patHash,
		Description: "PAT for update test",
	})
	require.NoError(t, err)

	// Update last used timestamp
	now := timestamppb.Now()
	err = ts.UpdatePATLastUsed(ctx, user.ID, "pat-update-test", now)
	require.NoError(t, err)

	// Verify the update
	pats, err := ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 1)
	require.NotNil(t, pats[0].LastUsedAt)
	require.Equal(t, now.AsTime(), pats[0].LastUsedAt.AsTime())

	// An older asynchronous update must not make the last-used time regress.
	err = ts.UpdatePATLastUsed(ctx, user.ID, "pat-update-test", timestamppb.New(now.AsTime().Add(-time.Hour)))
	require.NoError(t, err)
	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, now.AsTime(), pats[0].LastUsedAt.AsTime())

	ts.Close()
}

func TestUserSettingGetUserByPATHashWithExpiredToken(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT with expiration info
	patHash := "pat-hash-with-expiry"
	expiresAt := timestamppb.Now()
	pat := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-expiry-test",
		TokenHash:   patHash,
		Description: "PAT with expiry",
		ExpiresAt:   expiresAt,
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat)
	require.NoError(t, err)

	// Should still be able to look up by hash (expiry check is done at auth level)
	result, err := ts.GetUserByPATHash(ctx, patHash)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, user.ID, result.UserID)
	require.NotNil(t, result.PAT.ExpiresAt)

	ts.Close()
}

func TestUserSettingGetUserByPATHashAfterRemoval(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT
	patHash := "pat-hash-to-remove"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-remove-test",
		TokenHash:   patHash,
		Description: "PAT to be removed",
	})
	require.NoError(t, err)

	// Verify it exists
	result, err := ts.GetUserByPATHash(ctx, patHash)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Remove the PAT
	err = ts.RemoveUserPersonalAccessToken(ctx, user.ID, "pat-remove-test")
	require.NoError(t, err)

	// Should no longer be found
	result, err = ts.GetUserByPATHash(ctx, patHash)
	require.Error(t, err)
	require.Nil(t, result)

	ts.Close()
}

func TestUserSettingGetUserByPATHashSpecialCharacters(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create PATs with special characters in hash (simulating real hash values)
	testCases := []struct {
		tokenID   string
		tokenHash string
	}{
		{"pat-special-1", "abc123+/=XYZ"},
		{"pat-special-2", "sha256:abcdef1234567890"},
		{"pat-special-3", "$2a$10$N9qo8uLOickgx2ZMRZoMy"},
	}

	for _, tc := range testCases {
		err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
			TokenId:     tc.tokenID,
			TokenHash:   tc.tokenHash,
			Description: "PAT with special chars",
		})
		require.NoError(t, err)

		// Verify lookup works with special characters
		result, err := ts.GetUserByPATHash(ctx, tc.tokenHash)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, tc.tokenID, result.PAT.TokenId)
	}

	ts.Close()
}

func TestUserSettingGetUserByPATHashLargeTokenCount(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create many PATs for the same user
	tokenCount := 10
	hashes := make([]string, tokenCount)
	for i := 0; i < tokenCount; i++ {
		hashes[i] = "pat-hash-" + string(rune('A'+i)) + "-large-test"
		err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
			TokenId:     "pat-large-" + string(rune('A'+i)),
			TokenHash:   hashes[i],
			Description: "PAT for large count test",
		})
		require.NoError(t, err)
	}

	// Verify each hash can be looked up
	for i, hash := range hashes {
		result, err := ts.GetUserByPATHash(ctx, hash)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, user.ID, result.UserID)
		require.Equal(t, "pat-large-"+string(rune('A'+i)), result.PAT.TokenId)
	}

	ts.Close()
}
