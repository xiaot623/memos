package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestDeleteUserIsIdempotent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingUserWithRole(ctx, ts, "delete-idempotent", store.RoleUser)
	require.NoError(t, err)
	first, err := ts.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
	require.NoError(t, err)
	require.NotNil(t, first)
	second, err := ts.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
	require.NoError(t, err)
	require.NotNil(t, second)
	require.Empty(t, second.UserSettingKeys)
}
