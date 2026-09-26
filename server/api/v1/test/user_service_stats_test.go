package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestGetUserStats_AttachmentStorage(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	owner, err := ts.CreateRegularUser(ctx, "storage_owner")
	require.NoError(t, err)
	other, err := ts.CreateRegularUser(ctx, "storage_other")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	request := &v1pb.GetUserStatsRequest{Name: "users/" + owner.Username}

	stats, err := ts.Service.GetUserStats(ownerCtx, request)
	require.NoError(t, err)
	require.NotNil(t, stats.AttachmentStorageBytes)
	require.Zero(t, *stats.AttachmentStorageBytes)

	attachment := createTestImageAttachment(ownerCtx, t, ts, "owner.png")
	createTestImageAttachment(ts.CreateUserContext(ctx, other.ID), t, ts, "other.png")

	// Memo filtering must not turn account storage into a partial total.
	stats, err = ts.Service.GetUserStats(ownerCtx, &v1pb.GetUserStatsRequest{Name: request.Name, Filter: `content.contains("no matches")`})
	require.NoError(t, err)
	require.Zero(t, stats.TotalMemoCount)
	require.NotNil(t, stats.AttachmentStorageBytes)
	require.Equal(t, attachment.Size, *stats.AttachmentStorageBytes)

	for _, viewerCtx := range []context.Context{ctx, ts.CreateUserContext(ctx, other.ID)} {
		stats, err = ts.Service.GetUserStats(viewerCtx, request)
		require.NoError(t, err)
		require.Nil(t, stats.AttachmentStorageBytes, "private storage totals must not appear in public user stats")
	}

	_, err = ts.Service.DeleteAttachment(ownerCtx, &v1pb.DeleteAttachmentRequest{Name: attachment.Name})
	require.NoError(t, err)
	stats, err = ts.Service.GetUserStats(ownerCtx, request)
	require.NoError(t, err)
	require.NotNil(t, stats.AttachmentStorageBytes)
	require.Zero(t, *stats.AttachmentStorageBytes)
}
