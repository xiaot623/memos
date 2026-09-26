package sqlite

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

// loadSQLiteMemoParticipation resolves the current actor, Space, membership,
// and memo state used by reaction authorization.
func loadSQLiteMemoParticipation(ctx context.Context, tx dbExecutor, memoID, actorUserID int32) (*store.ReactionAuthorizationSnapshot, error) {
	actor, err := readSQLiteMemoActor(ctx, tx, actorUserID)
	if err != nil {
		return nil, err
	}
	snapshot := &store.ReactionAuthorizationSnapshot{ActorUserID: actorUserID, Actor: actor, MemoID: memoID}

	var memoSpace sql.NullInt64
	err = tx.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.MemoCreatorID, &snapshot.MemoRowStatus, &snapshot.MemoVisibility, &memoSpace,
	)
	if err != nil {
		return nil, err
	}
	snapshot.MemoSpaceID = store.NullInt32Pointer(memoSpace)

	if snapshot.MemoSpaceID != nil {
		var exists bool
		if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", *snapshot.MemoSpaceID).Scan(&exists); err == nil {
			snapshot.MemoSpaceExists = exists
		} else if !stderrors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		if snapshot.MemoMemberActive, err = sqliteSpaceMemberActive(ctx, tx, *snapshot.MemoSpaceID, actorUserID); err != nil {
			return nil, err
		}
		// Creators participate in their own SPACE memos even if membership lapsed.
		if snapshot.MemoCreatorID == actorUserID {
			snapshot.MemoMemberActive = true
		}
	}
	return snapshot, nil
}
