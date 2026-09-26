package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoShareFiltersAndExpiryRoundTrip(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	peer, err := createTestingUserWithRole(ctx, ts, "share-peer", store.RoleUser)
	require.NoError(t, err)
	var shares []*store.MemoShare
	for i, user := range []*store.User{owner, peer} {
		memo, err := ts.CreateMemo(ctx, &store.Memo{UID: user.Username, CreatorID: user.ID, Content: "memo", Visibility: store.Private})
		require.NoError(t, err)
		var expiry *int64
		if i == 1 {
			expiry = new(time.Now().Add(-time.Hour).Unix())
		}
		share, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: user.Username, MemoID: memo.ID, CreatorID: user.ID, ExpiresTs: expiry})
		require.NoError(t, err)
		shares = append(shares, share)
	}
	for _, share := range shares {
		for _, find := range []*store.FindMemoShare{
			{ID: &share.ID}, {UID: &share.UID}, {MemoID: &share.MemoID}, {CreatorID: &share.CreatorID},
			{ID: &share.ID, UID: &share.UID, MemoID: &share.MemoID, CreatorID: &share.CreatorID},
		} {
			got, err := ts.GetMemoShare(ctx, find)
			require.NoError(t, err)
			require.Equal(t, share, got)
			list, err := ts.ListMemoShares(ctx, find)
			require.NoError(t, err)
			require.Equal(t, []*store.MemoShare{share}, list, "store listing includes expired grants for management")
		}
	}
	find := &store.FindMemoShare{ID: &shares[0].ID, CreatorID: &peer.ID}
	got, err := ts.GetMemoShare(ctx, find)
	require.NoError(t, err)
	require.Nil(t, got)
	list, err := ts.ListMemoShares(ctx, find)
	require.NoError(t, err)
	require.Empty(t, list)
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{UID: shares[0].UID, MemoID: shares[1].MemoID, CreatorID: peer.ID})
	require.Error(t, err, "duplicate bearer token must not replace its original grant")
	list, err = ts.ListMemoShares(ctx, &store.FindMemoShare{})
	require.NoError(t, err)
	require.Equal(t, shares, list)
}
