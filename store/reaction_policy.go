package store

import "github.com/pkg/errors"

// ReactionWritePolicy identifies the actor for a transport-facing reaction
// mutation. Drivers authorize that actor against the memo's current state.
type ReactionWritePolicy struct {
	ActorUserID int32
}

// ReactionAuthorizationSnapshot is the memo-local database state read by a
// driver before it upserts or deletes a reaction.
type ReactionAuthorizationSnapshot struct {
	ActorUserID int32
	Actor       MemoActorState

	MemoID         int32
	MemoCreatorID  int32
	MemoRowStatus  RowStatus
	MemoVisibility Visibility
	MemoSpaceID    *int32

	MemoSpaceExists  bool
	MemoMemberActive bool
}

func validateReactionWritePolicy(reaction *Reaction) error {
	if reaction == nil || reaction.Policy == nil {
		return nil
	}
	policy := reaction.Policy
	if reaction.CreatorID <= 0 || reaction.MemoID <= 0 || policy.ActorUserID <= 0 {
		return errors.New("reaction write policy requires reaction, actor, and memo")
	}
	if reaction.CreatorID != policy.ActorUserID {
		return ErrReactionPermissionDenied
	}
	return nil
}

// ValidateReactionWriteParticipation applies the reaction actor identity and
// memo-local participation rules to state loaded by the write transaction.
func ValidateReactionWriteParticipation(reaction *Reaction, snapshot *ReactionAuthorizationSnapshot) error {
	if err := ValidateReactionWithdrawal(reaction, snapshot); err != nil {
		return err
	}
	return validateReactionMemoParticipation(snapshot)
}

// ValidateReactionWithdrawal allows an active actor to withdraw their own reaction
// without requiring continued access to or participation in the memo. The driver
// also verifies ownership of the stored reaction in the same transaction.
func ValidateReactionWithdrawal(reaction *Reaction, snapshot *ReactionAuthorizationSnapshot) error {
	if err := validateReactionWritePolicy(reaction); err != nil {
		return err
	}
	if reaction == nil || reaction.Policy == nil || snapshot == nil {
		return errors.New("reaction write participation state is required")
	}
	if snapshot.ActorUserID != reaction.Policy.ActorUserID {
		return ErrReactionPermissionDenied
	}
	if !snapshot.Actor.Active {
		return ErrReactionPermissionDenied
	}
	if snapshot.MemoID != reaction.MemoID {
		return ErrMemoMutationConflict
	}
	return nil
}

func validateReactionMemoParticipation(snapshot *ReactionAuthorizationSnapshot) error {
	if snapshot == nil || snapshot.ActorUserID <= 0 || !snapshot.Actor.Active {
		return ErrReactionPermissionDenied
	}
	if snapshot.MemoID <= 0 || snapshot.MemoRowStatus != Normal || !isValidVisibility(snapshot.MemoVisibility) {
		return ErrReactionPermissionDenied
	}
	if snapshot.MemoVisibility == SpaceAudience && (snapshot.MemoSpaceID == nil || !snapshot.MemoSpaceExists) {
		return ErrReactionPermissionDenied
	}
	switch snapshot.MemoVisibility {
	case Private:
		if snapshot.MemoCreatorID != snapshot.ActorUserID {
			return ErrReactionPermissionDenied
		}
	case SpaceAudience:
		if snapshot.MemoCreatorID != snapshot.ActorUserID && !snapshot.MemoMemberActive {
			return ErrReactionPermissionDenied
		}
	default:
		return ErrReactionPermissionDenied
	}
	return nil
}
