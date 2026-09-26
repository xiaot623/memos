package store_test

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func TestLoadDeploymentConfigurationValidatesAffectedAuthState(t *testing.T) {
	ctx := context.Background()

	t.Run("managed GENERAL stores disallowPasswordAuth", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), 0, true)
		require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
		general, err := stores.GetInstanceGeneralSetting(ctx)
		require.NoError(t, err)
		assert.True(t, general.DisallowPasswordAuth)
	})

	t.Run("unrelated file does not reject unmanaged legacy state", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.NoError(t, err)
		dir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-storage.json"), []byte(`{
  "key": "STORAGE",
  "storageSetting": {"storageType": "LOCAL"}
}`), 0600))
		require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	})
}

func TestLoadDeploymentConfigurationIgnoresUnrelatedFilesAndMissingDirectory(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".env"), []byte("DATABASE_PASSWORD=secret"), 0600))
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, filepath.Join(t.TempDir(), "missing")))
}

func TestLoadDeploymentConfigurationAcceptsSaturdayWeekStart(t *testing.T) {
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), -1, false)
	require.NoError(t, stores.LoadDeploymentConfigurationDir(context.Background(), dir))

	general, err := stores.GetInstanceGeneralSetting(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(-1), general.WeekStartDayOffset)
}

func TestLoadDeploymentConfigurationRejectsInvalidSettingResources(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		errorString string
	}{
		{name: "BASIC", content: `{"key":"BASIC","basicSetting":{}}`, errorString: "cannot be deployment configured"},
		{name: "TAGS", content: `{"key":"TAGS","tagsSetting":{}}`, errorString: "cannot be deployment configured"},
		{name: "mismatched oneof", content: `{"key":"GENERAL","storageSetting":{}}`, errorString: "generalSetting must be populated"},
		{name: "invalid week start", content: `{"key":"GENERAL","generalSetting":{"weekStartDayOffset":-2}}`, errorString: "must be between -1 and 6"},
		{name: "unknown field", content: `{"key":"GENERAL","generalSetting":{},"typo":true}`, errorString: `unknown field "typo"`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stores := newDeploymentConfigurationTestStore(t)
			dir := t.TempDir()
			require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-invalid.json"), []byte(test.content), 0600))
			err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
			require.Error(t, err)
			assert.ErrorContains(t, err, test.errorString)
		})
	}
}

func TestLoadDeploymentConfigurationBoundsFilesAndRedactsDecodeErrors(t *testing.T) {
	t.Run("oversized file", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-general.json"), []byte(strings.Repeat("x", (1<<20)+1)), 0600))
		err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
		require.Error(t, err)
		assert.ErrorContains(t, err, "exceeds 1048576 bytes")
	})

	t.Run("secret value is not included in a type error", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		content := `{
  "key": "GENERAL",
  "generalSetting": {"weekStartDayOffset": "must-not-appear"}
}`
		require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-general.json"), []byte(content), 0600))
		err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
		require.Error(t, err)
		assert.NotContains(t, err.Error(), "must-not-appear")
	})
}

func newDeploymentConfigurationTestStore(t *testing.T) *store.Store {
	t.Helper()
	p := &profile.Profile{
		Data:   t.TempDir(),
		Driver: "sqlite",
		DSN:    filepath.Join(t.TempDir(), "deployment.db"),
	}
	driver, err := sqlite.NewDB(p)
	require.NoError(t, err)
	stores := store.New(driver, p)
	require.NoError(t, stores.Migrate(context.Background()))
	t.Cleanup(func() {
		require.NoError(t, stores.Close())
	})
	return stores
}

func writeDeploymentGeneralSetting(t *testing.T, path string, weekStart int32, disallowPasswordAuth bool) {
	t.Helper()
	content := `{
  "key": "GENERAL",
  "generalSetting": {
    "weekStartDayOffset": ` + assertInt32(weekStart) + `,
    "disallowPasswordAuth": ` + assertBool(disallowPasswordAuth) + `
  }
}`
	require.NoError(t, os.WriteFile(path, []byte(content), 0600))
}

func writeDeploymentMessage(t *testing.T, path string, message proto.Message) {
	t.Helper()
	content, err := (protojson.MarshalOptions{Indent: "  "}).Marshal(message)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, content, 0600))
}

func assertInt32(value int32) string {
	return strconv.FormatInt(int64(value), 10)
}

func assertBool(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func ptr[T any](value T) *T {
	return &value
}
