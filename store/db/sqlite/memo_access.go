package sqlite

import (
	"fmt"

	"github.com/usememos/memos/store"
)

// sqliteMemoAccessPredicate builds the canonical memo-local read predicate for
// memoAlias and appends its bind values to args.
//
// PRIVATE is visible only to its creator. SPACE is visible to the creator and
// active members of that space (space_id required). There is no public or
// protected audience, and instance admins do not bypass these rules in list
// predicates.
func sqliteMemoAccessPredicate(access *store.MemoAccessScope, memoAlias, memberAlias string, args *[]any) string {
	if access == nil || access.UserID == nil {
		return "1 = 0"
	}

	*args = append(*args, *access.UserID)
	userActive := "EXISTS (SELECT 1 FROM `user` AS `access_user` WHERE `access_user`.`id` = ? AND `access_user`.`row_status` = 'NORMAL')"

	*args = append(*args, *access.UserID)
	privateOK := "(" + memoAlias + ".`visibility` = 'PRIVATE' AND " + memoAlias + ".`creator_id` = ?)"

	*args = append(*args, *access.UserID, *access.UserID)
	spaceOK := "(" + memoAlias + ".`visibility` = 'SPACE' AND " + memoAlias + ".`space_id` IS NOT NULL AND (" +
		memoAlias + ".`creator_id` = ? OR EXISTS (SELECT 1 FROM `space_member` AS " + memberAlias +
		" WHERE " + memberAlias + ".`space_id` = " + memoAlias + ".`space_id` AND " + memberAlias + ".`user_id` = ?" +
		" AND " + memberAlias + ".`status` = 'ACTIVE' AND " + memberAlias + ".`role` IN ('ADMIN', 'USER'))))"

	audience := "(" + privateOK + " OR " + spaceOK + ")"

	validMemo := "(" + memoAlias + ".`visibility` IN ('PRIVATE', 'SPACE')" +
		" AND EXISTS (SELECT 1 FROM `user` AS `valid_creator` WHERE `valid_creator`.`id` = " + memoAlias + ".`creator_id` AND `valid_creator`.`row_status` IN ('NORMAL', 'ARCHIVED'))" +
		" AND (" + memoAlias + ".`visibility` <> 'SPACE' OR (" + memoAlias + ".`space_id` IS NOT NULL" +
		" AND EXISTS (SELECT 1 FROM `space` AS `valid_space` WHERE `valid_space`.`id` = " + memoAlias + ".`space_id`))))"

	*args = append(*args, *access.UserID)
	validState := fmt.Sprintf("(%s.`row_status` = 'NORMAL' OR (%s.`row_status` = 'ARCHIVED' AND %s.`creator_id` = ?))", memoAlias, memoAlias, memoAlias)

	return "(" + userActive + " AND " + audience + ") AND " + validMemo + " AND " + validState
}
