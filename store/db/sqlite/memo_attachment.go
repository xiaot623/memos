package sqlite

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/store"
)

// ApplyMemoMutation atomically updates a memo and its attachment bindings.
func (d *DB) ApplyMemoMutation(ctx context.Context, mutation *store.MemoMutation) error {
	// BEGIN IMMEDIATE avoids SQLITE_BUSY on deferred write upgrades (issue #6186).
	conn, err := d.db.Conn(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get database connection")
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, "BEGIN IMMEDIATE"); err != nil {
		return errors.Wrap(err, "failed to begin memo transaction")
	}
	committed := false
	defer func() {
		if !committed {
			_, _ = conn.ExecContext(context.WithoutCancel(ctx), "ROLLBACK")
		}
	}()
	if create := mutation.MemoCreate; create != nil {
		if err := validateSQLiteMemoCreate(ctx, conn, create); err != nil {
			return err
		}
		if err := insertSQLiteMemo(ctx, conn, create); err != nil {
			return err
		}
		mutation.MemoID = create.ID
		mutation.MemoCreatorID = create.CreatorID
		mutation.ExpectedMemoContent = create.Content
	}
	policy := mutation.WritePolicy()
	actorUserID := mutation.ActorUserID()
	actorIsAdmin := false
	if policy != nil {
		snapshot, err := validateSQLiteMemoWritePolicy(ctx, conn, mutation.MemoID, policy, mutation.MemoUpdate)
		if err != nil {
			return err
		}
		actorIsAdmin = snapshot.ActorIsAdmin
	}

	var creatorID int32
	var content string
	if err := conn.QueryRowContext(ctx, `SELECT creator_id, content FROM memo WHERE id = ?`, mutation.MemoID).Scan(&creatorID, &content); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.Wrap(store.ErrMemoMutationConflict, "memo no longer exists")
		}
		return errors.Wrap(err, "failed to lock memo")
	}
	if creatorID != mutation.MemoCreatorID || content != mutation.ExpectedMemoContent {
		return errors.Wrap(store.ErrMemoMutationConflict, "memo changed while applying mutation")
	}
	removedAttachments, err := listSQLiteAttachmentSnapshots(ctx, conn, mutation.RemovedAttachmentIDs)
	if err != nil {
		return errors.Wrap(err, "failed to read removed attachments")
	}
	if len(removedAttachments) != len(mutation.RemovedAttachmentIDs) {
		return errors.Wrap(store.ErrMemoMutationConflict, "removed attachment no longer exists")
	}
	for _, attachment := range removedAttachments {
		if !store.MemoAttachmentRemovalAllowed(attachment, mutation.MemoID, actorUserID, actorIsAdmin) {
			return errors.Wrap(store.ErrMemoMutationConflict, "attachment is no longer removable from the memo")
		}
	}

	for _, binding := range mutation.Bindings {
		var attachmentCreatorID int32
		var memoID sql.NullInt32
		if err := conn.QueryRowContext(ctx, `SELECT creator_id, memo_id FROM attachment WHERE id = ?`, binding.ID).Scan(&attachmentCreatorID, &memoID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return errors.Wrapf(store.ErrMemoMutationConflict, "attachment %s no longer exists", binding.UID)
			}
			return errors.Wrap(err, "failed to lock attachment")
		}
		if binding.WasBoundToMemo {
			if !memoID.Valid || memoID.Int32 != mutation.MemoID {
				return errors.Wrapf(store.ErrMemoMutationConflict, "attachment %s is no longer bound to the memo", binding.UID)
			}
		} else if !store.MemoAttachmentBindingOwnerAllowed(attachmentCreatorID, mutation.MemoCreatorID, actorUserID, actorIsAdmin) || memoID.Valid {
			return errors.Wrapf(store.ErrMemoMutationConflict, "attachment %s is no longer available", binding.UID)
		}
		if _, err := conn.ExecContext(ctx, `UPDATE attachment SET memo_id = ?, updated_ts = ? WHERE id = ?`, mutation.MemoID, binding.UpdatedTs, binding.ID); err != nil {
			return errors.Wrap(err, "failed to bind attachment")
		}
	}
	for _, attachment := range removedAttachments {
		result, err := conn.ExecContext(ctx, `DELETE FROM attachment WHERE id = ? AND memo_id = ?`, attachment.ID, mutation.MemoID)
		if err != nil {
			return errors.Wrap(err, "failed to delete removed attachment")
		}
		if rows, err := result.RowsAffected(); err != nil {
			return errors.Wrap(err, "failed to count deleted removed attachment")
		} else if rows != 1 {
			return errors.Wrap(store.ErrMemoMutationConflict, "attachment is no longer bound to the memo")
		}
	}

	for _, attachmentID := range mutation.RequiredAttachmentIDs {
		var exists int
		if err := conn.QueryRowContext(ctx, `SELECT 1 FROM attachment WHERE id = ? AND memo_id = ?`, attachmentID, mutation.MemoID).Scan(&exists); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return errors.Wrap(store.ErrMemoMutationConflict, "a referenced attachment is no longer bound to the memo")
			}
			return errors.Wrap(err, "failed to verify referenced attachment")
		}
	}

	if mutation.MemoUpdate != nil {
		if mutation.MemoUpdate.ID != mutation.MemoID {
			return errors.New("memo update target does not match attachment mutation")
		}
		if err := applyMemoUpdate(ctx, conn, mutation.MemoUpdate); err != nil {
			return err
		}
	}
	if _, err := conn.ExecContext(ctx, "COMMIT"); err != nil {
		return errors.Wrap(err, "failed to commit memo transaction")
	}
	committed = true
	return nil
}

type memoUpdateExecer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func applyMemoUpdate(ctx context.Context, executor memoUpdateExecer, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.UID; v != nil {
		set, args = append(set, "`uid` = ?"), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "`content` = ?"), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "`visibility` = ?"), append(args, *v)
	}
	if v := update.Pinned; v != nil {
		set, args = append(set, "`pinned` = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		payload, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal memo payload")
		}
		set, args = append(set, "`payload` = ?"), append(args, string(payload))
	}
	if update.ClearSpace {
		set = append(set, "`space_id` = NULL")
	} else if v := update.SpaceID; v != nil {
		set, args = append(set, "`space_id` = ?"), append(args, *v)
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)
	if _, err := executor.ExecContext(ctx, "UPDATE `memo` SET "+strings.Join(set, ", ")+" WHERE `id` = ?", args...); err != nil {
		return errors.Wrap(err, "failed to update memo")
	}
	return nil
}
