package test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/pkg/errors"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	// MemosDockerImage is the published image used to bootstrap an older schema.
	MemosDockerImage = "neosmemo/memos"
	// StableMemosVersion is the previous stable release upgrades are tested from.
	// Pinned rather than tracking the floating "stable" tag so a Docker Hub retag
	// cannot change what CI verifies. Bump this when a new stable ships.
	// scripts/release_smoke_test.sh detects the previous release from Git tags
	// instead, so the black-box tier still follows "stable" automatically.
	StableMemosVersion = "0.30.0"
)

// TerminateContainers is a no-op kept for TestMain. SQLite tests do not start
// database containers.
func TerminateContainers() {}

func skipIfContainerProviderUnavailable(t *testing.T) {
	t.Helper()
	if os.Getenv("SKIP_CONTAINER_TESTS") == "1" {
		t.Skip("skipping container-based test (SKIP_CONTAINER_TESTS=1)")
	}
	testcontainers.SkipIfProviderIsNotHealthy(t)
}

// MemosContainerConfig holds configuration for starting a Memos container.
type MemosContainerConfig struct {
	Version string // Memos version tag (e.g., "0.24.0")
	Driver  string // Database driver. Only sqlite is supported.
	DSN     string // Unused. Kept so existing call sites still compile.
	DataDir string // Host directory to mount for SQLite data
}

// MemosStartupWaitStrategy defines the wait strategy for Memos container startup.
// Uses regex to match various log message formats across versions.
var MemosStartupWaitStrategy = wait.ForAll(
	wait.ForLog("(started successfully|has been started on port)").AsRegexp(),
	wait.ForListeningPort("5230/tcp"),
).WithDeadline(180 * time.Second)

// StartMemosContainer starts a Memos container for migration testing.
// It mounts dataDir to /var/opt/memos and uses the sqlite driver.
func StartMemosContainer(ctx context.Context, cfg MemosContainerConfig) (testcontainers.Container, error) {
	if cfg.Driver != "sqlite" {
		return nil, errors.Errorf("unsupported driver for migration testing: %s", cfg.Driver)
	}

	env := map[string]string{
		"MEMOS_MODE":   "prod",
		"MEMOS_DRIVER": "sqlite",
	}
	req := testcontainers.ContainerRequest{
		Image:        fmt.Sprintf("%s:%s", MemosDockerImage, cfg.Version),
		Env:          env,
		ExposedPorts: []string{"5230/tcp"},
		WaitingFor:   MemosStartupWaitStrategy,
		User:         fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()),
	}

	if cfg.Version == "local" {
		if os.Getenv("MEMOS_TEST_IMAGE_BUILT") == "1" {
			req.Image = "memos-test:local"
		} else {
			req.Image = ""
			req.FromDockerfile = testcontainers.FromDockerfile{
				Context:    "../../",
				Dockerfile: "scripts/Dockerfile",
			}
		}
	}

	genericReq := testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	}
	if err := testcontainers.WithHostConfigModifier(func(hc *container.HostConfig) {
		hc.Binds = append(hc.Binds, fmt.Sprintf("%s:%s", cfg.DataDir, "/var/opt/memos"))
	}).Customize(&genericReq); err != nil {
		return nil, errors.Wrap(err, "failed to mount sqlite data directory")
	}

	ctr, err := testcontainers.GenericContainer(ctx, genericReq)
	if err != nil {
		return nil, errors.Wrap(err, "failed to start memos container")
	}
	return ctr, nil
}
