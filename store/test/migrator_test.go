package test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func requireQueryError(ctx context.Context, t *testing.T, db *sql.DB, query string, message string) {
	t.Helper()
	_, err := db.QueryContext(ctx, query)
	require.Error(t, err, message)
}

func TestFreshInstall(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	ts := NewTestingStore(ctx, t)

	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.NotEmpty(t, currentSchemaVersion, "schema version should be set after fresh install")

	instanceSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentSchemaVersion, instanceSetting.SchemaVersion)

	insertSpace := "INSERT INTO space (id, uid, title, description, payload) VALUES (?, ?, ?, ?, '{}')"
	insertMemo := "INSERT INTO memo (id, uid, creator_id, content, visibility, payload, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertSpace, 900001, "fresh-space", "Fresh Space", "schema fixture")
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertMemo, 900001, "fresh-private", 1, "private", store.Private, `{}`, nil)
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertMemo, 900002, "fresh-space-memo", 1, "space", store.SpaceAudience, `{}`, 900001)
	require.NoError(t, err)

	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT parent_memo_id, root_memo_id FROM memo LIMIT 0", "fresh memo schema must not contain canonical-root columns")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT row_status FROM space LIMIT 0", "fresh Space schema has no archived state")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT id FROM memo_relation LIMIT 0", "fresh schema must not contain memo_relation")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT id FROM inbox LIMIT 0", "fresh schema must not contain inbox")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT id FROM idp LIMIT 0", "fresh schema must not contain idp")

	var indexName string
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
		"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_memo_creator_id'",
	).Scan(&indexName))
	require.Equal(t, "idx_memo_creator_id", indexName)
}
