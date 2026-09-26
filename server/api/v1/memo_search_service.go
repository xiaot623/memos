package v1

import (
	"context"
	stderrors "errors"
	"log/slog"
	"math"
	"sort"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai/embed"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/vector"
)

const (
	// semanticSearchSafetyLimit bounds how many points above the score threshold Qdrant may return.
	semanticSearchSafetyLimit = 50
	// defaultSemanticScoreThreshold is the cosine similarity cutoff when a user has not chosen one.
	// On normalized embeddings, 0.5 keeps paraphrases and related notes and drops orthogonal hits.
	defaultSemanticScoreThreshold float32 = 0.5
)

func semanticScoreThreshold(general *storepb.GeneralUserSetting) float32 {
	if general == nil || general.SemanticScoreThreshold == nil {
		return defaultSemanticScoreThreshold
	}
	return *general.SemanticScoreThreshold
}

func semanticScoreThresholdFromAPI(general *v1pb.UserSetting_GeneralSetting) float32 {
	if general == nil || general.SemanticScoreThreshold == nil {
		return defaultSemanticScoreThreshold
	}
	return *general.SemanticScoreThreshold
}

func normalizeSemanticScoreThreshold(value float32) (float32, error) {
	if math.IsNaN(float64(value)) || value < 0 || value > 1 {
		return 0, status.Errorf(codes.InvalidArgument, "semantic_score_threshold must be between 0 and 1")
	}
	return float32(math.Round(float64(value)*100) / 100), nil
}

func roundSimilarityScore(score float32) float32 {
	return float32(math.Round(float64(score)*100) / 100)
}

func similarityScoresForMemos(memos []*store.Memo, messages []*v1pb.Memo, scores map[int32]float32) []float32 {
	byName := make(map[string]float32, len(memos))
	for _, memo := range memos {
		byName[buildMemoName(memo.UID)] = roundSimilarityScore(scores[memo.ID])
	}
	aligned := make([]float32, len(messages))
	for i, message := range messages {
		aligned[i] = byName[message.GetName()]
	}
	return aligned
}

func semanticScoreThresholdPointer(value float32) *float32 {
	copied := value
	return &copied
}

// SearchMemos ranks memos by embedding similarity and then applies the same access checks as ListMemos.
func (s *APIV1Service) SearchMemos(ctx context.Context, request *v1pb.SearchMemosRequest) (*v1pb.SearchMemosResponse, error) {
	query := strings.TrimSpace(request.Query)
	if query == "" {
		return nil, status.Errorf(codes.InvalidArgument, "query is required")
	}
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	generalSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &currentUser.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get semantic index state: %v", err)
	}
	if generalSetting.GetGeneral().GetSemanticIndexState() != storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_READY {
		return nil, status.Errorf(codes.FailedPrecondition, "semantic search is not ready")
	}
	vectorStore := s.Store.Vector()
	if vectorStore == nil || !s.semanticSearchAvailable(ctx) {
		return nil, status.Errorf(codes.FailedPrecondition, "semantic search is not enabled")
	}
	client, dimensions, err := s.embeddingClient(ctx)
	if err != nil || client == nil {
		return nil, status.Errorf(codes.FailedPrecondition, "semantic search is not enabled")
	}
	if err := vectorStore.EnsureCollection(ctx, dimensions); err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "semantic search is unavailable")
	}
	vectors, err := client.Embed(ctx, []embed.Input{{Text: query}})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to embed query: %v", err)
	}

	memoFind := &store.FindMemo{}
	accessScope, _, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}
	memoFind.Access = accessScope
	qdrantFilter := vector.Filter{}
	if request.State == v1pb.State_ARCHIVED {
		state := store.Archived
		memoFind.RowStatus = &state
		memoFind.CreatorID = &currentUser.ID
		qdrantFilter.RowStatus = string(store.Archived)
	} else {
		state := store.Normal
		memoFind.RowStatus = &state
		qdrantFilter.RowStatus = string(store.Normal)
	}
	if request.Filter != "" {
		if err := s.validateMemoFilterForUser(ctx, request.Filter, currentUser); err != nil {
			return nil, err
		}
		memoFind.Filters = append(memoFind.Filters, request.Filter)
	}

	hits, err := vectorStore.Search(ctx, vectors[0], semanticSearchSafetyLimit, 0, semanticScoreThreshold(generalSetting.GetGeneral()), qdrantFilter)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search memos: %v", err)
	}
	scores := map[int32]float32{}
	for _, hit := range hits {
		if score, ok := scores[hit.Payload.MemoID]; !ok || hit.Score > score {
			scores[hit.Payload.MemoID] = hit.Score
		}
	}
	if len(scores) == 0 {
		return &v1pb.SearchMemosResponse{}, nil
	}
	ids := make([]int32, 0, len(scores))
	for id := range scores {
		ids = append(ids, id)
	}
	memoFind.IDList = ids
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}
	sort.SliceStable(memos, func(i, j int) bool {
		return scores[memos[i].ID] > scores[memos[j].ID]
	})

	limit := normalizePageSize(request.PageSize)
	offset := 0
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		offset = max(int(pageToken.Offset), 0)
	}
	if offset > len(memos) {
		offset = len(memos)
	}
	end := min(offset+limit, len(memos))
	page := memos[offset:end]
	messages, err := s.memoMessages(ctx, page)
	if err != nil {
		return nil, err
	}
	nextPageToken := ""
	if end < len(memos) {
		nextPageToken, err = getPageToken(limit, end)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token: %v", err)
		}
	}
	return &v1pb.SearchMemosResponse{
		Memos:            messages,
		NextPageToken:    nextPageToken,
		SimilarityScores: similarityScoresForMemos(page, messages, scores),
	}, nil
}

func (s *APIV1Service) memoMessages(ctx context.Context, memos []*store.Memo) ([]*v1pb.Memo, error) {
	if len(memos) == 0 {
		return []*v1pb.Memo{}, nil
	}
	memoIDs := make([]int32, 0, len(memos))
	for _, memo := range memos {
		memoIDs = append(memoIDs, memo.ID)
	}
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}
	reactionMap := map[int32][]*store.Reaction{}
	for _, reaction := range reactions {
		reactionMap[reaction.MemoID] = append(reactionMap[reaction.MemoID], reaction)
	}
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	attachmentMap := map[int32][]*store.Attachment{}
	for _, attachment := range attachments {
		if attachment.MemoID == nil {
			continue
		}
		attachmentMap[*attachment.MemoID] = append(attachmentMap[*attachment.MemoID], attachment)
	}
	creatorIDs := make([]int32, 0, len(memos)+len(reactions))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	creatorMap, err := s.listUsersByID(ctx, creatorIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo creators: %v", err)
	}
	messages := make([]*v1pb.Memo, 0, len(memos))
	for _, memo := range memos {
		message, err := s.convertMemoFromStoreWithCreators(ctx, memo, reactionMap[memo.ID], attachmentMap[memo.ID], creatorMap)
		if err != nil {
			if stderrors.Is(err, errMemoCreatorNotFound) {
				slog.Warn("Skipping memo with missing creator", slog.Int64("memo_id", int64(memo.ID)))
				continue
			}
			return nil, errors.Wrap(err, "failed to convert memo")
		}
		messages = append(messages, message)
	}
	return messages, nil
}
