package store

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

const (
	// DefaultDeploymentConfigurationDir is the directory scanned for runtime configuration files.
	DefaultDeploymentConfigurationDir = "/etc/secrets"
	maxDeploymentConfigurationSize    = 1 << 20
	maxEmbeddingModelLength = 256
)

var (
	instanceSettingDeploymentFilenameMatcher = regexp.MustCompile(`^memos-instance-setting-[a-z0-9]+(?:-[a-z0-9]+)*\.json$`)
	protoJSONUnknownFieldMatcher             = regexp.MustCompile(`unknown field "([^"]+)"`)
)

// LoadDeploymentConfiguration loads the default runtime deployment configuration.
func (s *Store) LoadDeploymentConfiguration(ctx context.Context) error {
	return s.LoadDeploymentConfigurationDir(ctx, DefaultDeploymentConfigurationDir)
}

// LoadDeploymentConfigurationDir loads and atomically publishes runtime configuration from dir.
func (s *Store) LoadDeploymentConfigurationDir(ctx context.Context, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			s.setDeploymentConfiguration(newDeploymentConfiguration())
			return nil
		}
		return errors.Wrap(err, "failed to read deployment configuration directory")
	}

	config := newDeploymentConfiguration()
	settingFiles := map[storepb.InstanceSettingKey]string{}
	for _, entry := range entries {
		name := entry.Name()
		path := filepath.Join(dir, name)
		switch {
		case instanceSettingDeploymentFilenameMatcher.MatchString(name):
			setting := &storepb.InstanceSetting{}
			if err := readDeploymentProtoJSON(path, setting); err != nil {
				return errors.Wrapf(err, "invalid instance setting deployment file %q", name)
			}
			if err := validateAndNormalizeDeploymentInstanceSetting(setting); err != nil {
				return errors.Wrapf(err, "invalid instance setting deployment file %q", name)
			}
			if previous, ok := settingFiles[setting.Key]; ok {
				return errors.Errorf("instance setting key %q is declared by both %q and %q", setting.Key, previous, name)
			}
			settingFiles[setting.Key] = name
			config.instanceSettings[setting.Key] = cloneInstanceSetting(setting)
		case strings.HasPrefix(name, "memos-"):
			slog.Warn("ignoring unrecognized Memos deployment configuration filename", "filename", name)
		default:
			// The directory may contain unrelated platform secret files.
		}
	}

	s.setDeploymentConfiguration(config)
	slog.Info("loaded deployment configuration", "instanceSettings", len(config.instanceSettings))
	return nil
}

func newDeploymentConfiguration() *deploymentConfiguration {
	return &deploymentConfiguration{
		instanceSettings: map[storepb.InstanceSettingKey]*storepb.InstanceSetting{},
	}
}

func readDeploymentProtoJSON(path string, message proto.Message) error {
	info, err := os.Stat(path)
	if err != nil {
		return errors.Wrap(err, "failed to inspect file")
	}
	if !info.Mode().IsRegular() {
		return errors.New("file must resolve to a regular file")
	}
	file, err := os.Open(path)
	if err != nil {
		return errors.Wrap(err, "failed to open file")
	}
	defer file.Close()
	info, err = file.Stat()
	if err != nil {
		return errors.Wrap(err, "failed to inspect file")
	}
	if !info.Mode().IsRegular() {
		return errors.New("file must resolve to a regular file")
	}
	content, err := io.ReadAll(io.LimitReader(file, maxDeploymentConfigurationSize+1))
	if err != nil {
		return errors.Wrap(err, "failed to read file")
	}
	if len(content) > maxDeploymentConfigurationSize {
		return errors.Errorf("file exceeds %d bytes", maxDeploymentConfigurationSize)
	}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: false}).Unmarshal(content, message); err != nil {
		if matches := protoJSONUnknownFieldMatcher.FindStringSubmatch(err.Error()); len(matches) == 2 {
			return errors.Errorf("failed to decode protobuf JSON: unknown field %q", matches[1])
		}
		return errors.New("failed to decode protobuf JSON; verify field names, value types, and JSON syntax")
	}
	return nil
}


func validateAndNormalizeDeploymentInstanceSetting(setting *storepb.InstanceSetting) error {
	switch setting.Key {
	case storepb.InstanceSettingKey_GENERAL:
		if setting.GetGeneralSetting() == nil {
			return errors.New("generalSetting must be populated for key GENERAL")
		}
		if offset := setting.GetGeneralSetting().WeekStartDayOffset; offset < -1 || offset > 6 {
			return errors.New("generalSetting.weekStartDayOffset must be between -1 and 6")
		}
	case storepb.InstanceSettingKey_STORAGE:
		storage := setting.GetStorageSetting()
		if storage == nil {
			return errors.New("storageSetting must be populated for key STORAGE")
		}
		// Normalization would silently self-heal this misconfiguration to LOCAL;
		// a deployment file declaring S3 without a config should fail loudly.
		if storage.StorageType == storepb.InstanceStorageSetting_S3 && storage.S3Config == nil && len(storage.Storages) == 0 {
			return errors.New("storageSetting.s3Config is required for S3")
		}
		NormalizeInstanceStorageSetting(storage)
		if storage.UploadSizeLimitMb < 0 {
			return errors.New("storageSetting.uploadSizeLimitMb must not be negative")
		}
		defaultStorage := GetDefaultStorage(storage)
		if defaultStorage != nil && defaultStorage.Type == storepb.StorageType_STORAGE_TYPE_S3 {
			s3Config := defaultStorage.GetS3Config()
			if s3Config == nil {
				return errors.New("storageSetting default storage S3 config is required")
			}
			for _, field := range []struct {
				name  string
				value string
			}{
				{name: "accessKeyId", value: s3Config.AccessKeyId},
				{name: "accessKeySecret", value: s3Config.AccessKeySecret},
				{name: "endpoint", value: s3Config.Endpoint},
				{name: "region", value: s3Config.Region},
				{name: "bucket", value: s3Config.Bucket},
			} {
				if strings.TrimSpace(field.value) == "" {
					return errors.Errorf("storageSetting default S3 config.%s is required", field.name)
				}
			}
		}
	case storepb.InstanceSettingKey_MEMO_RELATED:
		if setting.GetMemoRelatedSetting() == nil {
			return errors.New("memoRelatedSetting must be populated for key MEMO_RELATED")
		}
	case storepb.InstanceSettingKey_AI:
		if setting.GetAiSetting() == nil {
			return errors.New("aiSetting must be populated for key AI")
		}
		if err := normalizeDeploymentAISetting(setting.GetAiSetting()); err != nil {
			return err
		}
	case storepb.InstanceSettingKey_BASIC, storepb.InstanceSettingKey_TAGS:
		return errors.Errorf("key %s cannot be deployment configured", setting.Key)
	default:
		return errors.Errorf("unsupported instance setting key %s", setting.Key)
	}
	return nil
}

func normalizeDeploymentAISetting(setting *storepb.InstanceAISetting) error {
	providers := map[string]struct{}{}
	for i, provider := range setting.Providers {
		if provider == nil {
			return errors.Errorf("aiSetting.providers[%d] must not be null", i)
		}
		provider.Id = strings.TrimSpace(provider.Id)
		provider.Title = strings.TrimSpace(provider.Title)
		provider.Endpoint = strings.TrimSpace(provider.Endpoint)
		if provider.Id == "" || provider.Title == "" || provider.ApiKey == "" {
			return errors.Errorf("aiSetting.providers[%d] requires id, title, and apiKey", i)
		}
		if _, ok := providers[provider.Id]; ok {
			return errors.Errorf("aiSetting provider ID %q is duplicated", provider.Id)
		}
		providers[provider.Id] = struct{}{}
		switch provider.Type {
		case storepb.AIProviderType_OPENAI:
			if provider.Endpoint == "" {
				provider.Endpoint = "https://api.openai.com/v1"
			}
		case storepb.AIProviderType_GEMINI:
			if provider.Endpoint == "" {
				provider.Endpoint = "https://generativelanguage.googleapis.com/v1beta"
			}
		case storepb.AIProviderType_OPENROUTER:
			if provider.Endpoint == "" {
				provider.Endpoint = "https://openrouter.ai/api/v1"
			}
		default:
			return errors.Errorf("aiSetting provider %q has unsupported type", provider.Id)
		}
	}
	if embedding := setting.Embedding; embedding != nil {
		embedding.ProviderId = strings.TrimSpace(embedding.ProviderId)
		embedding.Model = strings.TrimSpace(embedding.Model)
		if embedding.Dimensions < 0 {
			return errors.New("aiSetting embedding dimensions must be positive")
		}
		if embedding.ProviderId != "" {
			if _, ok := providers[embedding.ProviderId]; !ok {
				return errors.Errorf("aiSetting embedding providerId %q does not reference a provider", embedding.ProviderId)
			}
			for _, provider := range setting.Providers {
				if provider != nil && provider.Id == embedding.ProviderId && provider.Type == storepb.AIProviderType_GEMINI {
					return errors.Errorf("aiSetting embedding provider %q does not support the GEMINI API", embedding.ProviderId)
				}
			}
		}
		if len(embedding.Model) > maxEmbeddingModelLength {
			return errors.New("aiSetting embedding model exceeds the supported length limit")
		}
	}
	return nil
}

func (s *Store) setDeploymentConfiguration(config *deploymentConfiguration) {
	copy := newDeploymentConfiguration()
	for key, setting := range config.instanceSettings {
		copy.instanceSettings[key] = cloneInstanceSetting(setting)
	}
	s.deploymentConfigMu.Lock()
	s.deploymentConfig = copy
	s.deploymentConfigMu.Unlock()
	// A deployment configuration can supply the STORAGE setting.
	s.resetStorageDriverCache()
}

// IsInstanceSettingDeploymentConfigured reports whether key is file-backed.
func (s *Store) IsInstanceSettingDeploymentConfigured(key storepb.InstanceSettingKey) bool {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	_, ok := s.deploymentConfig.instanceSettings[key]
	return ok
}

func (s *Store) getDeploymentInstanceSetting(key storepb.InstanceSettingKey) *storepb.InstanceSetting {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	return cloneInstanceSetting(s.deploymentConfig.instanceSettings[key])
}

func cloneInstanceSetting(setting *storepb.InstanceSetting) *storepb.InstanceSetting {
	if setting == nil {
		return nil
	}
	cloned := &storepb.InstanceSetting{}
	proto.Merge(cloned, setting)
	return cloned
}
