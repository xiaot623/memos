package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestSemanticScoreThreshold(t *testing.T) {
	require.Equal(t, float32(0.5), semanticScoreThreshold(nil))
	require.Equal(t, float32(0.5), semanticScoreThreshold(&storepb.GeneralUserSetting{}))

	zero := float32(0)
	require.Equal(t, float32(0), semanticScoreThreshold(&storepb.GeneralUserSetting{SemanticScoreThreshold: &zero}))

	strict := float32(0.8)
	require.Equal(t, float32(0.8), semanticScoreThreshold(&storepb.GeneralUserSetting{SemanticScoreThreshold: &strict}))
}

func TestNormalizeSemanticScoreThreshold(t *testing.T) {
	value, err := normalizeSemanticScoreThreshold(0.726)
	require.NoError(t, err)
	require.InDelta(t, 0.73, value, 0.001)

	_, err = normalizeSemanticScoreThreshold(1.1)
	require.Error(t, err)
}
