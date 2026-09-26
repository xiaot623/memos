package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestReactionWritePolicySpaceParticipationIsMemoLocal(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	outsider, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-outsider", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	applicationAdmin, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-app-admin", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	space, err := ts.CreateSpace(ctx, &store.Space{UID: "reaction-space", Title: "Reaction Space"}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	spaceMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-space-memo", CreatorID: owner.ID, Content: "space memo", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)

	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: spaceMemo.ID, ReactionType: "member", Policy: reactionWritePolicy(member.ID),
	})
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: outsider.ID, MemoID: spaceMemo.ID, ReactionType: "outsider", Policy: reactionWritePolicy(outsider.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied, "a non-member must not participate")
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: applicationAdmin.ID, MemoID: spaceMemo.ID, ReactionType: "application-admin", Policy: reactionWritePolicy(applicationAdmin.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied, "an instance administrator does not participate without membership")

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: spaceMemo.ID, ReactionType: "former-member", Policy: reactionWritePolicy(member.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied)

	assignedPrivate, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-space-private", CreatorID: owner.ID, Content: "private", Visibility: store.Private, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: assignedPrivate.ID, ReactionType: "private-member", Policy: reactionWritePolicy(member.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied, "Space membership must not broaden a PRIVATE memo")
}

func TestDeleteReactionAtomicallyEnforcesCreatorWithoutParticipation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "reaction-delete-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "reaction-delete-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "reaction-delete-space", Title: "Delete Reactions"}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-delete-memo", CreatorID: owner.ID, Content: "memo", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	reaction, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: memo.ID, ReactionType: "delete", Policy: reactionWritePolicy(member.ID),
	})
	require.NoError(t, err)

	err = ts.DeleteReaction(ctx, &store.DeleteReaction{
		ID: &reaction.ID, MemoID: &memo.ID, ActorUserID: &owner.ID, Policy: reactionWritePolicy(owner.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied)
	requireReactionPresent(ctx, t, ts, reaction.ID)

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))
	err = ts.DeleteReaction(ctx, &store.DeleteReaction{
		ID: &reaction.ID, MemoID: &memo.ID, ActorUserID: &member.ID, Policy: reactionWritePolicy(member.ID),
	})
	require.NoError(t, err, "creators can withdraw reactions after leaving the Space")

	requireReactionMissing(ctx, t, ts, reaction.ID)
}

func reactionWritePolicy(actorUserID int32) *store.ReactionWritePolicy {
	return &store.ReactionWritePolicy{ActorUserID: actorUserID}
}

func requireReactionPresent(ctx context.Context, t *testing.T, ts *store.Store, reactionID int32) {
	t.Helper()
	reaction, err := ts.GetReaction(ctx, &store.FindReaction{ID: &reactionID})
	require.NoError(t, err)
	require.NotNil(t, reaction)
}

func requireReactionMissing(ctx context.Context, t *testing.T, ts *store.Store, reactionID int32) {
	t.Helper()
	reaction, err := ts.GetReaction(ctx, &store.FindReaction{ID: &reactionID})
	require.NoError(t, err)
	require.Nil(t, reaction)
}
