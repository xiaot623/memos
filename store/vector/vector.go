// Package vector stores memo embeddings. Drivers are selected at process
// startup, the same way database drivers are.
package vector

import (
	"context"

	"github.com/pkg/errors"
)

// CollectionName is the single collection every driver uses.
const CollectionName = "memos"

// ErrDimensionMismatch means the existing collection was created with a different vector size.
var ErrDimensionMismatch = errors.New("vector collection dimensions do not match the embedding configuration")

// Point is one vector and the memo it belongs to.
type Point struct {
	ID      string
	Vector  []float32
	Payload Payload
}

// Payload is stored beside the vector so search can prefilter and group hits.
type Payload struct {
	MemoID       int32
	CreatorID    int32
	SpaceID      int32
	Visibility   string
	RowStatus    string
	AttachmentID int32
}

// Filter selects points by payload. Zero-value fields are ignored except when
// the corresponding pointer is set.
type Filter struct {
	MemoID       *int32
	CreatorID    *int32
	AttachmentID *int32
	RowStatus    string
}

// Hit is one nearest-neighbor result.
type Hit struct {
	ID      string
	Score   float32
	Payload Payload
}

// Store is a vector database.
type Store interface {
	// EnsureCollection creates the collection at dimensions, or accepts an existing one of that size.
	EnsureCollection(ctx context.Context, dimensions int) error
	Upsert(ctx context.Context, points []Point) error
	SetPayload(ctx context.Context, ids []string, payload Payload) error
	Delete(ctx context.Context, filter Filter) error
	// Search returns the nearest points at or above scoreThreshold, up to limit.
	// scoreThreshold is cosine similarity: higher means more similar.
	Search(ctx context.Context, vector []float32, limit, offset int, scoreThreshold float32, filter Filter) ([]Hit, error)
	Close() error
}

// New returns the driver named by driver. An empty driver means vector search is off.
func New(driver, dsn string) (Store, error) {
	switch driver {
	case "":
		return nil, nil
	case "qdrant":
		return newQdrant(dsn)
	default:
		return nil, errors.Errorf("unknown vector driver %q", driver)
	}
}
