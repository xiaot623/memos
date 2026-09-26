package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestSemanticScoreThreshold(t *testing.T) {
	require.Equal(t, float32(0.5), semanticScoreThreshold(nil))
	require.Equal(t, float32(0.5), semanticScoreThreshold(&storepb.GeneralUserSetting{}))

	zero := float32(0)
	require.Equal(t, float32(0), semanticScoreThreshold(&storepb.GeneralUserSetting{SemanticScoreThreshold: &zero}))

	strict := float32(0.8)
	require.Equal(t, float32(0.8), semanticScoreThreshold(&storepb.GeneralUserSetting{SemanticScoreThreshold: &strict}))
}

func TestRoundSimilarityScore(t *testing.T) {
	require.InDelta(t, 0.60, roundSimilarityScore(0.6017), 0.001)
	require.InDelta(t, 0.62, roundSimilarityScore(0.6152), 0.001)
}

func TestSimilarityScoresFollowReturnedMemos(t *testing.T) {
	memos := []*store.Memo{{ID: 1, UID: "a"}, {ID: 2, UID: "b"}}
	messages := []*v1pb.Memo{{Name: "memos/b"}}
	scores := similarityScoresForMemos(memos, messages, map[int32]float32{1: 0.2, 2: 0.6017})
	require.Equal(t, []float32{roundSimilarityScore(0.6017)}, scores)
}

func TestNormalizeSemanticScoreThreshold(t *testing.T) {
	value, err := normalizeSemanticScoreThreshold(0.726)
	require.NoError(t, err)
	require.InDelta(t, 0.73, value, 0.001)

	_, err = normalizeSemanticScoreThreshold(1.1)
	require.Error(t, err)
}
