package v1

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai/embed"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/vector"
)

const (
	semanticBackfillPageSize = 100
	maxEmbeddedImageBytes    = 8 << 20
)

var embeddableImageTypes = map[string]struct{}{
	"image/jpeg": {},
	"image/jpg":  {},
	"image/png":  {},
	"image/webp": {},
	"image/gif":  {},
}

type semanticJobKind int

const (
	semanticJobSyncMemo semanticJobKind = iota
	semanticJobBackfill
	semanticJobReconcile
)

type semanticJob struct {
	kind   semanticJobKind
	memoID int32
	userID int32
}

type semanticIndex struct {
	mu    sync.Mutex
	jobs  []semanticJob
	wake  chan struct{}
	stop  context.CancelFunc
	ended chan struct{}
}

// StartSemanticIndex resumes indexes for users who already opted in.
func (s *APIV1Service) StartSemanticIndex(ctx context.Context) {
	if s.semantic != nil {
		return
	}
	runCtx, cancel := context.WithCancel(ctx)
	s.semantic = &semanticIndex{
		wake:  make(chan struct{}, 1),
		stop:  cancel,
		ended: make(chan struct{}),
	}
	go s.runSemanticIndex(runCtx)
	s.enqueueSemantic(semanticJob{kind: semanticJobReconcile})
}

// StopSemanticIndex cancels background embedding work.
func (s *APIV1Service) StopSemanticIndex() {
	if s.semantic == nil {
		return
	}
	s.semantic.stop()
	<-s.semantic.ended
}

func (s *APIV1Service) enqueueSemantic(job semanticJob) {
	if s.semantic == nil {
		return
	}
	s.semantic.mu.Lock()
	s.semantic.jobs = append(s.semantic.jobs, job)
	s.semantic.mu.Unlock()
	select {
	case s.semantic.wake <- struct{}{}:
	default:
	}
}

func (s *APIV1Service) enqueueSemanticMemo(memoID int32) {
	s.enqueueSemantic(semanticJob{kind: semanticJobSyncMemo, memoID: memoID})
}

func (s *APIV1Service) enqueueSemanticBackfill(userID int32) {
	s.enqueueSemantic(semanticJob{kind: semanticJobBackfill, userID: userID})
}

func (s *APIV1Service) runSemanticIndex(ctx context.Context) {
	defer close(s.semantic.ended)
	for {
		job, ok := s.popSemanticJob()
		if !ok {
			select {
			case <-ctx.Done():
				return
			case <-s.semantic.wake:
			}
			continue
		}
		if err := s.handleSemanticJob(ctx, job); err != nil && ctx.Err() == nil {
			slog.Warn("semantic index job failed", slog.Any("err", err))
		}
	}
}

func (s *APIV1Service) popSemanticJob() (semanticJob, bool) {
	s.semantic.mu.Lock()
	defer s.semantic.mu.Unlock()
	if len(s.semantic.jobs) == 0 {
		return semanticJob{}, false
	}
	job := s.semantic.jobs[0]
	s.semantic.jobs = s.semantic.jobs[1:]
	return job, true
}

func (s *APIV1Service) handleSemanticJob(ctx context.Context, job semanticJob) error {
	switch job.kind {
	case semanticJobSyncMemo:
		return s.syncSemanticMemo(ctx, job.memoID)
	case semanticJobBackfill:
		return s.backfillSemanticUser(ctx, job.userID, true)
	case semanticJobReconcile:
		return s.reconcileSemanticIndexes(ctx)
	default:
		return nil
	}
}

func (s *APIV1Service) reconcileSemanticIndexes(ctx context.Context) error {
	if err := s.deleteOrphanSemanticPoints(ctx); err != nil {
		slog.Warn("failed to delete orphan semantic points", slog.Any("err", err))
	}
	users, err := s.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return errors.Wrap(err, "failed to list users")
	}
	for _, user := range users {
		state, err := s.semanticIndexState(ctx, user.ID)
		if err != nil {
			return err
		}
		switch state {
		case storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_INITIALIZING:
			if err := s.backfillSemanticUser(ctx, user.ID, true); err != nil {
				return err
			}
		case storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_READY:
			if err := s.backfillSemanticUser(ctx, user.ID, false); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *APIV1Service) backfillSemanticUser(ctx context.Context, userID int32, markReady bool) error {
	offset := 0
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		limit := semanticBackfillPageSize
		memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
			CreatorID:       &userID,
			ExcludeComments: true,
			Limit:           &limit,
			Offset:          &offset,
		})
		if err != nil {
			return errors.Wrap(err, "failed to list memos for semantic backfill")
		}
		for _, memo := range memos {
			if err := s.syncSemanticMemo(ctx, memo.ID); err != nil {
				slog.Warn("failed to index memo", slog.Int("memo", int(memo.ID)), slog.Any("err", err))
			}
		}
		if len(memos) < limit {
			break
		}
		offset += limit
	}
	if !markReady {
		return nil
	}
	state, err := s.semanticIndexState(ctx, userID)
	if err != nil {
		return err
	}
	if state != storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_INITIALIZING {
		return nil
	}
	return s.setSemanticIndexState(ctx, userID, storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_READY)
}

func (s *APIV1Service) syncSemanticMemo(ctx context.Context, memoID int32) error {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
	if err != nil {
		return errors.Wrap(err, "failed to get memo")
	}
	if memo == nil || memo.ParentUID != nil {
		return s.deleteSemanticMemo(ctx, memoID)
	}
	state, err := s.semanticIndexState(ctx, memo.CreatorID)
	if err != nil {
		return err
	}
	if state != storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_INITIALIZING && state != storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_READY {
		return nil
	}
	vectorStore := s.Store.Vector()
	if vectorStore == nil {
		return nil
	}
	client, dimensions, err := s.embeddingClient(ctx)
	if err != nil || client == nil {
		return err
	}
	if err := vectorStore.EnsureCollection(ctx, dimensions); err != nil {
		return err
	}

	desired := map[int32]struct{}{}
	text := strings.TrimSpace(memo.Content)
	if text != "" {
		desired[0] = struct{}{}
		if err := s.upsertSemanticText(ctx, vectorStore, client, memo, text, dimensions); err != nil {
			slog.Warn("failed to embed memo text", slog.Int("memo", int(memo.ID)), slog.Any("err", err))
		}
	}
	images, err := s.semanticImages(ctx, memo)
	if err != nil {
		return err
	}
	for _, image := range images {
		desired[image.ID] = struct{}{}
		if err := s.upsertSemanticImage(ctx, vectorStore, client, memo, image, dimensions); err != nil {
			slog.Warn("failed to embed memo image", slog.Int("memo", int(memo.ID)), slog.Int("attachment", int(image.ID)), slog.Any("err", err))
		}
	}

	existing, err := s.Store.ListMemoEmbeddings(ctx, memo.ID)
	if err != nil {
		return err
	}
	for _, row := range existing {
		if _, ok := desired[row.AttachmentID]; ok {
			continue
		}
		attachmentID := row.AttachmentID
		if err := vectorStore.Delete(ctx, vector.Filter{MemoID: &memo.ID, AttachmentID: &attachmentID}); err != nil {
			return err
		}
		if err := s.Store.DeleteMemoEmbedding(ctx, memo.ID, &attachmentID); err != nil {
			return err
		}
	}
	if text == "" {
		attachmentID := int32(0)
		if err := vectorStore.Delete(ctx, vector.Filter{MemoID: &memo.ID, AttachmentID: &attachmentID}); err != nil {
			return err
		}
		if err := s.Store.DeleteMemoEmbedding(ctx, memo.ID, &attachmentID); err != nil {
			return err
		}
	}
	return nil
}

func (s *APIV1Service) upsertSemanticText(ctx context.Context, vectorStore vector.Store, client *embed.Client, memo *store.Memo, text string, dimensions int) error {
	hash := hashText(text)
	payload := semanticPayload(memo, 0)
	existing, err := s.findMemoEmbedding(ctx, memo.ID, 0)
	if err != nil {
		return err
	}
	pointID := vector.PointID(memo.ID, 0)
	if existing != nil && !existing.Skipped && existing.ContentHash == hash && existing.Model == client.Model && int(existing.Dimensions) == dimensions {
		return vectorStore.SetPayload(ctx, []string{pointID}, payload)
	}
	vectors, err := client.Embed(ctx, []embed.Input{{Text: text}})
	if err != nil {
		return err
	}
	if err := vectorStore.Upsert(ctx, []vector.Point{{ID: pointID, Vector: vectors[0], Payload: payload}}); err != nil {
		return err
	}
	return s.Store.UpsertMemoEmbedding(ctx, &store.MemoEmbedding{
		MemoID:       memo.ID,
		AttachmentID: 0,
		ContentHash:  hash,
		Model:        client.Model,
		Dimensions:   int32(dimensions),
		UpdatedTs:    time.Now().Unix(),
	})
}

func (s *APIV1Service) upsertSemanticImage(ctx context.Context, vectorStore vector.Store, client *embed.Client, memo *store.Memo, attachment *store.Attachment, dimensions int) error {
	if attachment.Size > maxEmbeddedImageBytes {
		return s.skipSemanticImage(ctx, memo.ID, attachment, client.Model, dimensions, "size")
	}
	blob, err := s.GetAttachmentBlob(ctx, attachment)
	if err != nil {
		return err
	}
	if len(blob) > maxEmbeddedImageBytes {
		return s.skipSemanticImage(ctx, memo.ID, attachment, client.Model, dimensions, "size")
	}
	hash := hashBytes(blob)
	payload := semanticPayload(memo, attachment.ID)
	existing, err := s.findMemoEmbedding(ctx, memo.ID, attachment.ID)
	if err != nil {
		return err
	}
	pointID := vector.PointID(memo.ID, attachment.ID)
	if existing != nil && existing.ContentHash == hash && existing.Model == client.Model && int(existing.Dimensions) == dimensions {
		if existing.Skipped {
			return nil
		}
		return vectorStore.SetPayload(ctx, []string{pointID}, payload)
	}
	vectors, err := client.Embed(ctx, []embed.Input{{Image: blob, ImageMIME: attachment.Type}})
	if err != nil {
		if isEmbeddingRejected(err) {
			return s.skipSemanticImage(ctx, memo.ID, attachment, client.Model, dimensions, hash)
		}
		return err
	}
	if err := vectorStore.Upsert(ctx, []vector.Point{{ID: pointID, Vector: vectors[0], Payload: payload}}); err != nil {
		return err
	}
	return s.Store.UpsertMemoEmbedding(ctx, &store.MemoEmbedding{
		MemoID:       memo.ID,
		AttachmentID: attachment.ID,
		ContentHash:  hash,
		Model:        client.Model,
		Dimensions:   int32(dimensions),
		UpdatedTs:    time.Now().Unix(),
	})
}

func (s *APIV1Service) skipSemanticImage(ctx context.Context, memoID int32, attachment *store.Attachment, model string, dimensions int, hash string) error {
	if hash == "size" {
		hash = "skipped:" + attachment.UID
	}
	return s.Store.UpsertMemoEmbedding(ctx, &store.MemoEmbedding{
		MemoID:       memoID,
		AttachmentID: attachment.ID,
		ContentHash:  hash,
		Model:        model,
		Dimensions:   int32(dimensions),
		UpdatedTs:    time.Now().Unix(),
		Skipped:      true,
	})
}

func (s *APIV1Service) semanticImages(ctx context.Context, memo *store.Memo) ([]*store.Attachment, error) {
	linked, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &memo.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo attachments")
	}
	byID := map[int32]*store.Attachment{}
	for _, attachment := range linked {
		if isEmbeddableImage(attachment) {
			byID[attachment.ID] = attachment
		}
	}
	extracted, err := s.MarkdownService.ExtractAll([]byte(memo.Content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to extract memo images")
	}
	for _, reference := range extracted.ManagedAttachmentReferences {
		uid := reference.UID
		attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
		if err != nil || attachment == nil || !isEmbeddableImage(attachment) {
			continue
		}
		if attachment.CreatorID != memo.CreatorID {
			continue
		}
		if attachment.MemoID != nil && *attachment.MemoID != memo.ID {
			continue
		}
		byID[attachment.ID] = attachment
	}
	images := make([]*store.Attachment, 0, len(byID))
	for _, attachment := range byID {
		images = append(images, attachment)
	}
	return images, nil
}

func (s *APIV1Service) deleteSemanticMemo(ctx context.Context, memoID int32) error {
	if vectorStore := s.Store.Vector(); vectorStore != nil {
		if err := vectorStore.Delete(ctx, vector.Filter{MemoID: &memoID}); err != nil {
			return err
		}
	}
	return s.Store.DeleteMemoEmbedding(ctx, memoID, nil)
}

func (s *APIV1Service) deleteUserSemanticIndex(ctx context.Context, userID int32) error {
	if vectorStore := s.Store.Vector(); vectorStore != nil {
		if err := vectorStore.Delete(ctx, vector.Filter{CreatorID: &userID}); err != nil {
			return err
		}
	}
	return s.Store.DeleteMemoEmbeddingsByCreator(ctx, userID)
}

func (s *APIV1Service) deleteOrphanSemanticPoints(ctx context.Context) error {
	orphans, err := s.Store.ListOrphanMemoEmbeddings(ctx)
	if err != nil {
		return err
	}
	seen := map[int32]struct{}{}
	for _, orphan := range orphans {
		if _, ok := seen[orphan.MemoID]; ok {
			continue
		}
		seen[orphan.MemoID] = struct{}{}
		if err := s.deleteSemanticMemo(ctx, orphan.MemoID); err != nil {
			return err
		}
	}
	return nil
}

func (s *APIV1Service) embeddingClient(ctx context.Context) (*embed.Client, int, error) {
	setting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to get AI setting")
	}
	embedding := setting.GetEmbedding()
	if embedding.GetProviderId() == "" || embedding.GetModel() == "" {
		return nil, 0, nil
	}
	provider, err := s.resolveAIProvider(setting, embedding.GetProviderId())
	if err != nil {
		return nil, 0, err
	}
	dimensions := int(embedding.GetDimensions())
	if dimensions == 0 {
		dimensions = embed.DefaultDimensions
	}
	return &embed.Client{
		Endpoint:   provider.Endpoint,
		APIKey:     provider.APIKey,
		Model:      embedding.GetModel(),
		Dimensions: dimensions,
	}, dimensions, nil
}

func (s *APIV1Service) semanticIndexState(ctx context.Context, userID int32) (storepb.SemanticIndexState, error) {
	setting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_GENERAL,
	})
	if err != nil {
		return storepb.SemanticIndexState_SEMANTIC_INDEX_STATE_OFF, errors.Wrap(err, "failed to get user setting")
	}
	return setting.GetGeneral().GetSemanticIndexState(), nil
}

func (s *APIV1Service) setSemanticIndexState(ctx context.Context, userID int32, state storepb.SemanticIndexState) error {
	setting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_GENERAL,
	})
	if err != nil {
		return errors.Wrap(err, "failed to get user setting")
	}
	general := &storepb.GeneralUserSetting{}
	if existing := setting.GetGeneral(); existing != nil {
		cloned, ok := proto.Clone(existing).(*storepb.GeneralUserSetting)
		if !ok {
			return errors.New("failed to clone user general setting")
		}
		general = cloned
	}
	general.SemanticIndexState = state
	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: general},
	}); err != nil {
		return errors.Wrap(err, "failed to update semantic index state")
	}
	return nil
}

func (s *APIV1Service) findMemoEmbedding(ctx context.Context, memoID, attachmentID int32) (*store.MemoEmbedding, error) {
	rows, err := s.Store.ListMemoEmbeddings(ctx, memoID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row.AttachmentID == attachmentID {
			return row, nil
		}
	}
	return nil, nil
}

func semanticPayload(memo *store.Memo, attachmentID int32) vector.Payload {
	spaceID := int32(0)
	if memo.SpaceID != nil {
		spaceID = *memo.SpaceID
	}
	return vector.Payload{
		MemoID:       memo.ID,
		CreatorID:    memo.CreatorID,
		SpaceID:      spaceID,
		Visibility:   memo.Visibility.String(),
		RowStatus:    string(memo.RowStatus),
		AttachmentID: attachmentID,
	}
}

func isEmbeddableImage(attachment *store.Attachment) bool {
	if attachment == nil {
		return false
	}
	_, ok := embeddableImageTypes[strings.ToLower(attachment.Type)]
	return ok
}

func isEmbeddingRejected(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "returned 4")
}

func hashText(text string) string {
	return hashBytes([]byte(text))
}

func hashBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}
