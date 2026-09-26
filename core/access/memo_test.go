package access

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestCheckMemoReadPrivate(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal}
	other := &store.User{ID: 2, RowStatus: store.Normal, Role: store.RoleUser}
	admin := &store.User{ID: 3, RowStatus: store.Normal, Role: store.RoleAdmin}
	private := &store.Memo{ID: 3, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private}

	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: private, Viewer: owner, CreatorValid: true, SpaceValid: true}).Allowed())
	require.Equal(t, MemoReadDenialPermission, CheckMemoReadContext(MemoReadContext{Memo: private, Viewer: other, CreatorValid: true, SpaceValid: true}).Denial)
	require.Equal(t, MemoReadDenialPermission, CheckMemoReadContext(MemoReadContext{Memo: private, Viewer: admin, CreatorValid: true, SpaceValid: true}).Denial)
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(MemoReadContext{Memo: private, CreatorValid: true, SpaceValid: true}).Denial)

	shareID := private.ID
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: private, SharedMemoID: &shareID, CreatorValid: true, SpaceValid: true}).Allowed())
}

func TestCheckMemoReadSpaceAudience(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal}
	member := &store.User{ID: 2, RowStatus: store.Normal}
	appAdmin := &store.User{ID: 3, RowStatus: store.Normal, Role: store.RoleAdmin}
	spaceID := int32(7)
	memo := &store.Memo{ID: 10, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.SpaceAudience, SpaceID: &spaceID}

	base := MemoReadContext{Memo: memo, CreatorValid: true, SpaceValid: true}
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(base).Denial)

	base.Viewer = owner
	require.True(t, CheckMemoReadContext(base).Allowed(), "creator reads SPACE memo without membership flag")

	base.Viewer = member
	base.ViewerSpaceMember = true
	require.True(t, CheckMemoReadContext(base).Allowed())

	base.Viewer = appAdmin
	base.ViewerSpaceMember = false
	require.Equal(t, MemoReadDenialPermission, CheckMemoReadContext(base).Denial, "admins do not bypass SPACE membership")

	shareID := memo.ID
	base.Viewer = nil
	base.SharedMemoID = &shareID
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(base).Denial, "share tokens do not open SPACE memos")

	memo.SpaceID = nil
	base.Viewer = member
	base.ViewerSpaceMember = true
	base.SharedMemoID = nil
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(base).Denial)
}

func TestCanManageMemoAndAttachment(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal, Role: store.RoleUser}
	admin := &store.User{ID: 2, RowStatus: store.Normal, Role: store.RoleAdmin}
	archivedAdmin := &store.User{ID: 3, RowStatus: store.Archived, Role: store.RoleAdmin}
	private := &store.Memo{ID: 1, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private}

	require.True(t, CanManageMemo(owner, private))
	require.True(t, CanManageMemo(admin, private))
	require.False(t, CanManageMemo(archivedAdmin, private))
	require.False(t, CanManageMemo(&store.User{ID: 4, RowStatus: store.Normal, Role: store.RoleUser}, private))

	attachment := &store.Attachment{ID: 1, CreatorID: owner.ID}
	require.True(t, CanManageAttachment(owner, attachment))
	require.True(t, CanManageAttachment(admin, attachment))
	require.False(t, CanManageAttachment(archivedAdmin, attachment))
}

func TestCheckMemoReadInvalidStateFailsClosed(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal}
	spaceID := int32(7)
	memo := &store.Memo{ID: 10, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private, SpaceID: &spaceID}

	require.True(t, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: false,
	}).Allowed(), "PRIVATE remains readable by its active author")

	memo.Visibility = store.SpaceAudience
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: false, ViewerSpaceMember: true,
	}).Denial, "SPACE depends on a valid assigned Space")

	memo.SpaceID = nil
	memo.Visibility = store.Visibility("FUTURE_AUDIENCE")
	shareID := memo.ID
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, SharedMemoID: &shareID, CreatorValid: true, SpaceValid: true,
	}).Denial)

	memo.Visibility = store.Private
	memo.RowStatus = store.Archived
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: true}).Allowed())
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: &store.User{ID: 2, RowStatus: store.Normal}, CreatorValid: true, SpaceValid: true,
	}).Denial, "archived memos are only visible to the author")
}
