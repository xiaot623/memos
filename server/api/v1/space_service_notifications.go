package v1

import (
	"context"

	"github.com/usememos/memos/store"
)

// Space invitations no longer send email or write inbox notifications.
// These stubs keep call sites in space_service.go compiling without side effects.

func (*APIV1Service) createSpaceInvitationNotification(_ context.Context, _ *store.Space, _, _ *store.User) {
}

func (*APIV1Service) archiveSpaceInvitationNotifications(_ context.Context, _, _ int32) {
}

func (*APIV1Service) deleteSpaceInvitationNotifications(_ context.Context, _, _ int32) {
}
