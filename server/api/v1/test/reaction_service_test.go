package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestUpsertMemoReactionRequiresReaction(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "reaction-required-user")
	require.NoError(t, err)
	_, err = ts.Service.UpsertMemoReaction(ts.CreateUserContext(ctx, user.ID), &apiv1.UpsertMemoReactionRequest{
		Name: "memos/missing",
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}
