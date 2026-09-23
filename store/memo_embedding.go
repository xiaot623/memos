package store

import (
	"context"
	"strconv"
	"strings"

	"github.com/pkg/errors"
)

// MemoEmbedding is one indexed memo body or image.
type MemoEmbedding struct {
	MemoID       int32
	AttachmentID int32
	ContentHash  string
	Model        string
	Dimensions   int32
	UpdatedTs    int64
	Skipped      bool
}

// ListMemoEmbeddings returns the ledger rows for one memo.
func (s *Store) ListMemoEmbeddings(ctx context.Context, memoID int32) ([]*MemoEmbedding, error) {
	query := s.rebind(`SELECT memo_id, attachment_id, content_hash, model, dimensions, updated_ts, skipped FROM memo_embedding WHERE memo_id = ?`)
	rows, err := s.driver.GetDB().QueryContext(ctx, query, memoID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo embeddings")
	}
	defer rows.Close()

	var embeddings []*MemoEmbedding
	for rows.Next() {
		var embedding MemoEmbedding
		var skipped int
		if err := rows.Scan(&embedding.MemoID, &embedding.AttachmentID, &embedding.ContentHash, &embedding.Model, &embedding.Dimensions, &embedding.UpdatedTs, &skipped); err != nil {
			return nil, errors.Wrap(err, "failed to scan memo embedding")
		}
		embedding.Skipped = skipped != 0
		embeddings = append(embeddings, &embedding)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate memo embeddings")
	}
	return embeddings, nil
}

// UpsertMemoEmbedding inserts or replaces one ledger row.
func (s *Store) UpsertMemoEmbedding(ctx context.Context, embedding *MemoEmbedding) error {
	skipped := 0
	if embedding.Skipped {
		skipped = 1
	}
	query := s.memoEmbeddingUpsertQuery()
	if _, err := s.driver.GetDB().ExecContext(ctx, query, embedding.MemoID, embedding.AttachmentID, embedding.ContentHash, embedding.Model, embedding.Dimensions, embedding.UpdatedTs, skipped); err != nil {
		return errors.Wrap(err, "failed to upsert memo embedding")
	}
	return nil
}

// DeleteMemoEmbedding removes one ledger row. A nil attachmentID removes every row for the memo.
func (s *Store) DeleteMemoEmbedding(ctx context.Context, memoID int32, attachmentID *int32) error {
	query := `DELETE FROM memo_embedding WHERE memo_id = ?`
	args := []any{memoID}
	if attachmentID != nil {
		query += ` AND attachment_id = ?`
		args = append(args, *attachmentID)
	}
	if _, err := s.driver.GetDB().ExecContext(ctx, s.rebind(query), args...); err != nil {
		return errors.Wrap(err, "failed to delete memo embedding")
	}
	return nil
}

// ListOrphanMemoEmbeddings returns ledger rows whose memo no longer exists.
func (s *Store) ListOrphanMemoEmbeddings(ctx context.Context) ([]*MemoEmbedding, error) {
	query := `SELECT memo_id, attachment_id FROM memo_embedding WHERE NOT EXISTS (SELECT 1 FROM memo WHERE memo.id = memo_embedding.memo_id)`
	rows, err := s.driver.GetDB().QueryContext(ctx, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list orphan memo embeddings")
	}
	defer rows.Close()
	var embeddings []*MemoEmbedding
	for rows.Next() {
		var embedding MemoEmbedding
		if err := rows.Scan(&embedding.MemoID, &embedding.AttachmentID); err != nil {
			return nil, errors.Wrap(err, "failed to scan orphan memo embedding")
		}
		embeddings = append(embeddings, &embedding)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate orphan memo embeddings")
	}
	return embeddings, nil
}

// DeleteMemoEmbeddingsByCreator removes ledger rows for every memo owned by the user.
func (s *Store) DeleteMemoEmbeddingsByCreator(ctx context.Context, creatorID int32) error {
	query := s.rebind(`DELETE FROM memo_embedding WHERE memo_id IN (SELECT id FROM memo WHERE creator_id = ?)`)
	if _, err := s.driver.GetDB().ExecContext(ctx, query, creatorID); err != nil {
		return errors.Wrap(err, "failed to delete memo embeddings for user")
	}
	return nil
}

func (s *Store) memoEmbeddingUpsertQuery() string {
	switch s.profile.Driver {
	case "mysql":
		return `INSERT INTO memo_embedding (memo_id, attachment_id, content_hash, model, dimensions, updated_ts, skipped)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE content_hash = VALUES(content_hash), model = VALUES(model), dimensions = VALUES(dimensions), updated_ts = VALUES(updated_ts), skipped = VALUES(skipped)`
	case "postgres":
		return `INSERT INTO memo_embedding (memo_id, attachment_id, content_hash, model, dimensions, updated_ts, skipped)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (memo_id, attachment_id) DO UPDATE SET content_hash = EXCLUDED.content_hash, model = EXCLUDED.model, dimensions = EXCLUDED.dimensions, updated_ts = EXCLUDED.updated_ts, skipped = EXCLUDED.skipped`
	default:
		return `INSERT INTO memo_embedding (memo_id, attachment_id, content_hash, model, dimensions, updated_ts, skipped)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(memo_id, attachment_id) DO UPDATE SET content_hash = excluded.content_hash, model = excluded.model, dimensions = excluded.dimensions, updated_ts = excluded.updated_ts, skipped = excluded.skipped`
	}
}

func (s *Store) rebind(query string) string {
	if s.profile.Driver != "postgres" {
		return query
	}
	var builder strings.Builder
	index := 1
	for _, char := range query {
		if char == '?' {
			builder.WriteByte('$')
			builder.WriteString(strconv.Itoa(index))
			index++
			continue
		}
		builder.WriteRune(char)
	}
	return builder.String()
}
