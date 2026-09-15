package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestCreateMemoAppendsPATDescriptionTag(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "pat-tag-user")
	require.NoError(t, err)

	t.Run("appends sanitized description as tag", func(t *testing.T) {
		patCtx := ts.CreatePATContext(ctx, user, "Telegram")
		memo, err := ts.Service.CreateMemo(patCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Hello from the bot",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "Hello from the bot\n#Telegram", memo.Content)
		require.Equal(t, []string{"Telegram"}, memo.Tags)
	})

	t.Run("jwt context does not append a tag", func(t *testing.T) {
		userCtx := ts.CreateUserContext(ctx, user.ID)
		memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Typed in the web UI",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "Typed in the web UI", memo.Content)
		require.Empty(t, memo.Tags)
	})

	t.Run("does not duplicate an existing tag", func(t *testing.T) {
		patCtx := ts.CreatePATContext(ctx, user, "Telegram")
		memo, err := ts.Service.CreateMemo(patCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Already tagged #telegram",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "Already tagged #telegram", memo.Content)
		require.Equal(t, []string{"telegram"}, memo.Tags)
	})

	t.Run("spaces in description become kebab-case", func(t *testing.T) {
		patCtx := ts.CreatePATContext(ctx, user, "Telegram bot")
		memo, err := ts.Service.CreateMemo(patCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Incoming",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "Incoming\n#Telegram-bot", memo.Content)
		require.Equal(t, []string{"Telegram-bot"}, memo.Tags)
	})

	t.Run("empty content becomes just the tag", func(t *testing.T) {
		patCtx := ts.CreatePATContext(ctx, user, "Telegram")
		memo, err := ts.Service.CreateMemo(patCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "#Telegram", memo.Content)
		require.Equal(t, []string{"Telegram"}, memo.Tags)
	})

	t.Run("comments skip the source tag", func(t *testing.T) {
		patCtx := ts.CreatePATContext(ctx, user, "Telegram")
		parent, err := ts.Service.CreateMemo(ts.CreateUserContext(ctx, user.ID), &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Parent memo",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)

		comment, err := ts.Service.CreateMemoComment(patCtx, &apiv1.CreateMemoCommentRequest{
			Name: parent.Name,
			Comment: &apiv1.Memo{
				Content: "A comment from PAT",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "A comment from PAT", comment.Content)
		require.Empty(t, comment.Tags)
	})
}
