package sqlite

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestSQLiteMemoAccessPredicateAnonymous(t *testing.T) {
	args := []any{}
	predicate := sqliteMemoAccessPredicate(nil, "`memo`", "`access_member`", &args)

	require.Empty(t, args)
	require.Contains(t, predicate, "`memo`.`visibility` = 'PUBLIC'")
	require.Contains(t, predicate, "`memo`.`row_status` = 'NORMAL'")
	require.NotContains(t, predicate, "creator_id` = ?")
	require.NotContains(t, predicate, "1 = 0")
}

func TestSQLiteMemoAccessPredicateAuthenticatedIncludesPublic(t *testing.T) {
	userID := int32(7)
	args := []any{}
	predicate := sqliteMemoAccessPredicate(&store.MemoAccessScope{UserID: &userID}, "`memo`", "`access_member`", &args)

	require.Contains(t, predicate, "`memo`.`visibility` = 'PUBLIC'")
	require.Contains(t, predicate, "`memo`.`visibility` = 'PRIVATE'")
	require.Contains(t, predicate, "`memo`.`visibility` = 'SPACE'")
	require.NotEmpty(t, args)
}
