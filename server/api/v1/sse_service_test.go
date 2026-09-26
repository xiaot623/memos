package v1

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	"github.com/usememos/memos/internal/profile"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// newIntegrationService builds a minimal APIV1Service backed by an in-memory
// SQLite database.  The store is closed automatically via t.Cleanup.
func newIntegrationService(t *testing.T) *APIV1Service {
	t.Helper()
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() { st.Close() })
	p := &profile.Profile{Demo: true, Data: t.TempDir(), Driver: "sqlite", DSN: ":memory:"}
	return NewAPIV1Service("test-secret", p, st)
}

// userCtx returns a context that authenticates as the given user.
func userCtx(ctx context.Context, userID int32) context.Context {
	return context.WithValue(ctx, auth.UserIDContextKey, userID)
}

// collectEventsFor reads events from ch for the given duration and returns them.
func collectEventsFor(ch <-chan []byte, d time.Duration) []string {
	var out []string
	deadline := time.After(d)
	for {
		select {
		case data := <-ch:
			out = append(out, string(data))
		case <-deadline:
			return out
		}
	}
}

func requireMemoChanged(t *testing.T, ch <-chan []byte) {
	t.Helper()
	require.Equal(t, memoChangedSSEFrame, string(mustReceive(t, ch, time.Second)))
}

func requireSpaceChanged(t *testing.T, ch <-chan []byte) {
	t.Helper()
	require.Equal(t, spaceChangedSSEFrame, string(mustReceive(t, ch, time.Second)))
}

func requireNoMemoChanged(t *testing.T, ch <-chan []byte) {
	t.Helper()
	select {
	case event := <-ch:
		require.Failf(t, "unexpected SSE event", "received %q", event)
	default:
	}
}

func TestAttachmentMutationsPublishMemoChangedOnlyWhenBound(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-attachment-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "attachment event memo", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	createAttachment := func(filename string, memoName *string) *v1pb.Attachment {
		t.Helper()
		attachment, err := svc.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
			Filename: filename,
			Type:     "text/plain",
			Content:  []byte(filename),
			Memo:     memoName,
		}})
		require.NoError(t, err)
		return attachment
	}

	unbound := createAttachment("sse-unbound.txt", nil)
	requireNoMemoChanged(t, client.events)
	_, err = svc.UpdateAttachment(ownerCtx, &v1pb.UpdateAttachmentRequest{
		Attachment: &v1pb.Attachment{Name: unbound.Name, Filename: "sse-unbound-renamed.txt"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
	})
	require.NoError(t, err)
	requireNoMemoChanged(t, client.events)
	_, err = svc.DeleteAttachment(ownerCtx, &v1pb.DeleteAttachmentRequest{Name: unbound.Name})
	require.NoError(t, err)
	requireNoMemoChanged(t, client.events)

	bound := createAttachment("sse-bound.txt", &memo.Name)
	requireMemoChanged(t, client.events)
	_, err = svc.UpdateAttachment(ownerCtx, &v1pb.UpdateAttachmentRequest{
		Attachment: &v1pb.Attachment{Name: bound.Name, Filename: "sse-bound-renamed.txt"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
	})
	require.NoError(t, err)
	requireMemoChanged(t, client.events)
	_, err = svc.DeleteAttachment(ownerCtx, &v1pb.DeleteAttachmentRequest{Name: bound.Name})
	require.NoError(t, err)
	requireMemoChanged(t, client.events)

	firstUnbound := createAttachment("sse-batch-unbound-first.txt", nil)
	secondUnbound := createAttachment("sse-batch-unbound-second.txt", nil)
	requireNoMemoChanged(t, client.events)
	_, err = svc.BatchDeleteAttachments(ownerCtx, &v1pb.BatchDeleteAttachmentsRequest{
		Names: []string{firstUnbound.Name, secondUnbound.Name},
	})
	require.NoError(t, err)
	requireNoMemoChanged(t, client.events)

	mixedUnbound := createAttachment("sse-batch-mixed-unbound.txt", nil)
	mixedBound := createAttachment("sse-batch-mixed-bound.txt", &memo.Name)
	requireMemoChanged(t, client.events)
	_, err = svc.BatchDeleteAttachments(ownerCtx, &v1pb.BatchDeleteAttachmentsRequest{
		Names: []string{mixedUnbound.Name, mixedBound.Name},
	})
	require.NoError(t, err)
	requireMemoChanged(t, client.events)
}

func TestUpdateAttachmentPublishesAfterCommittedAccessChange(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-attachment-access-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	space, err := svc.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "sse-attachment-access-space",
		Space:   &v1pb.Space{Title: "Attachment access space"},
	})
	require.NoError(t, err)
	spaceName := space.Name
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{
		Content:    "attachment access changed during update",
		Visibility: v1pb.Visibility_SPACE,
		Space:      &spaceName,
	}})
	require.NoError(t, err)
	attachment, err := svc.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "before.txt",
		Type:     "text/plain",
		Content:  []byte("attachment"),
		Memo:     &memo.Name,
	}})
	require.NoError(t, err)
	attachmentUID, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	storedAttachment, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	require.NoError(t, err)
	require.NotNil(t, storedAttachment)

	// Authorization is checked before the attachment update. Simulate membership
	// changing in the same transaction so the committed response can no longer be
	// built through the read-authorized GetAttachment service method.
	trigger := fmt.Sprintf(`
		CREATE TRIGGER revoke_attachment_owner_membership
		AFTER UPDATE OF filename ON attachment
		WHEN NEW.id = %d
		BEGIN
			DELETE FROM space_member WHERE user_id = %d;
		END`, storedAttachment.ID, owner.ID)
	_, err = svc.Store.GetDriver().GetDB().ExecContext(ctx, trigger)
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	updated, err := svc.UpdateAttachment(ownerCtx, &v1pb.UpdateAttachmentRequest{
		Attachment: &v1pb.Attachment{Name: attachment.Name, Filename: "after.txt"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
	})
	require.NoError(t, err)
	require.Equal(t, "after.txt", updated.Filename)
	requireMemoChanged(t, client.events)
	requireNoMemoChanged(t, client.events)

	_, err = svc.GetAttachment(ownerCtx, &v1pb.GetAttachmentRequest{Name: attachment.Name})
	require.NoError(t, err, "the memo creator still reads the attachment after leaving the space")
}

func TestDeleteAttachmentPublishesBeforeStorageCleanupFailure(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-attachment-cleanup-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "attachment cleanup failure", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	attachment, err := svc.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "cleanup.txt",
		Type:     "text/plain",
		Content:  []byte("attachment"),
		Memo:     &memo.Name,
	}})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	_, err = svc.DeleteAttachment(store.WithDeleteAttachmentStorageFailpoint(ownerCtx), &v1pb.DeleteAttachmentRequest{Name: attachment.Name})
	require.Equal(t, codes.Internal, status.Code(err))
	require.ErrorContains(t, err, "attachments were deleted but storage cleanup failed")
	requireMemoChanged(t, client.events)
	requireNoMemoChanged(t, client.events)

	attachmentUID, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	storedAttachment, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	require.NoError(t, err)
	require.Nil(t, storedAttachment, "the database deletion must remain committed")
}

func TestSpaceMutationsPublishSpaceChanged(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-space-owner", store.RoleAdmin)
	member := createSpaceTestUser(ctx, t, svc, "sse-space-member", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	space, err := svc.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "sse-space",
		Space:   &v1pb.Space{Title: "SSE Space"},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	space.Title = "Renamed SSE Space"
	_, err = svc.UpdateSpace(ownerCtx, &v1pb.UpdateSpaceRequest{
		Space:      space,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	invitation, err := svc.CreateSpaceInvitation(ownerCtx, &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: BuildUserName(member.Username), Role: v1pb.SpaceMember_USER},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)
	membership, err := svc.AcceptSpaceInvitation(userCtx(ctx, member.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	membership.Role = v1pb.SpaceMember_ADMIN
	_, err = svc.UpdateSpaceMember(ownerCtx, &v1pb.UpdateSpaceMemberRequest{
		SpaceMember: membership,
		UpdateMask:  &fieldmaskpb.FieldMask{Paths: []string{"role"}},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	_, err = svc.DeleteSpaceMember(ownerCtx, &v1pb.DeleteSpaceMemberRequest{Name: membership.Name})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	_, err = svc.DeleteSpace(ownerCtx, &v1pb.DeleteSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)
}

func TestDeleteMemoCleansAttachmentStorage(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "delete-cleanup-owner", Role: store.RoleAdmin, Email: "delete-cleanup-owner@example.com",
	})
	require.NoError(t, err)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "attachment cleanup", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	memoUID, err := ExtractMemoUIDFromName(memo.Name)
	require.NoError(t, err)
	storedMemo, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, storedMemo)
	attachmentPath := filepath.Join(t.TempDir(), "sse-delete-cleanup.txt")
	require.NoError(t, os.WriteFile(attachmentPath, []byte("cleanup"), 0o600))
	attachment, err := svc.Store.CreateAttachment(ctx, &store.Attachment{
		UID:         "sse-delete-cleanup",
		CreatorID:   owner.ID,
		Filename:    "cleanup.txt",
		Type:        "text/plain",
		Size:        7,
		Blob:        []byte("cleanup"),
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   attachmentPath,
		MemoID:      &storedMemo.ID,
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	_, err = svc.DeleteMemo(ownerCtx, &v1pb.DeleteMemoRequest{Name: memo.Name})
	require.NoError(t, err, "committed deletion must not be reported as a failure")
	requireMemoChanged(t, client.events)

	deletedMemo, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.Nil(t, deletedMemo)
	deletedAttachment, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Nil(t, deletedAttachment)
	_, err = os.Stat(attachmentPath)
	require.ErrorIs(t, err, os.ErrNotExist)
}
