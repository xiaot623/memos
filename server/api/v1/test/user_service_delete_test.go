package test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/api/v1"
	"github.com/usememos/memos/store"
)

func TestDeleteUserReportsPostCommitAttachmentStorageCleanupFailure(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "cleanup-failure-owner")
	require.NoError(t, err)

	_, err = ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:         "attach-cleanup-failure",
		CreatorID:   user.ID,
		Filename:    "failure.txt",
		Type:        "text/plain",
		Size:        7,
		Blob:        []byte("failure"),
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   "cleanup-failure.txt",
	})
	require.NoError(t, err)
	attachmentPath := filepath.Join(ts.Profile.Data, "cleanup-failure.txt")
	require.NoError(t, os.WriteFile(attachmentPath, []byte("failure"), 0o600))

	headerCtx := apiv1.WithHeaderCarrier(ctx)
	authCtx := ts.CreateUserContext(store.WithDeleteAttachmentStorageFailpoint(headerCtx), user.ID)
	_, err = ts.Service.DeleteUser(authCtx, &v1pb.DeleteUserRequest{
		Name: apiv1.BuildUserName(user.Username),
	})
	require.Equal(t, codes.Internal, status.Code(err))
	require.ErrorContains(t, err, "user was deleted but attachment storage cleanup failed")
	require.ErrorContains(t, err, store.ErrDeleteAttachmentStorageFailpoint.Error())

	deletedUser, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)
	require.FileExists(t, attachmentPath, "storage cleanup failure happens after the database deletion commits")
}
