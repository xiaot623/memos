package vector

import (
	"fmt"

	"github.com/google/uuid"
)

// pointNamespace keeps point ids stable for a memo and attachment pair.
var pointNamespace = uuid.MustParse("6f1b5c2e-9a4d-4e7b-8c31-0d5a6e7f8091")

// PointID is the stable Qdrant point id for a memo body (attachmentID 0) or image.
func PointID(memoID, attachmentID int32) string {
	return uuid.NewSHA1(pointNamespace, []byte(fmt.Sprintf("%d:%d", memoID, attachmentID))).String()
}
