package v1

import (
	"context"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) buildUpdatedMemoState(ctx context.Context, memoID int32) (*store.Memo, *store.Memo, *v1pb.Memo, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to get memo")
	}
	if memo == nil {
		return nil, nil, nil, errors.New("memo not found")
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to list reactions")
	}
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to list attachments")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments)
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to convert memo")
	}

	return memo, nil, memoMessage, nil
}

func (s *APIV1Service) dispatchMemoUpdatedSideEffects(
	_ context.Context,
	_ *v1pb.Memo,
) {
	s.SSEHub.publishMemoChanged()
}
