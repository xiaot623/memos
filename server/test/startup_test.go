// Package test contains black-box startup smoke tests for the full server.
//
// Every other server test constructs apiv1.APIV1Service directly, which skips
// server.NewServer entirely. That leaves route registration, gRPC-gateway
// wiring, MCP/fileserver/frontend mounting, CORS and the secret bootstrap
// covered only by the Docker release script. These tests boot the real server
// the same way cmd/memos/main.go does so a wiring regression fails in CI.
package test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	// sqlite driver.
	_ "modernc.org/sqlite"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	"github.com/usememos/memos/server"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

const (
	testAdminUsername = "startup-admin"
	testAdminPassword = "startup-password"
)

// instanceOptions configures a single server boot.
type instanceOptions struct {
	// demo enables demo mode, which seeds the database during migration.
	demo bool
	// instanceURL is the canonical external instance URL. On the first boot of
	// a database without ACCESS, it is also the legacy compatibility input used
	// to initialize that dedicated setting exactly once.
	instanceURL string
	// rateLimit enables the request rate limiter, which the other tests leave
	// off so that their request volume never trips a budget.
	rateLimit bool
	// dataDir reuses an existing data directory instead of a fresh one, which
	// is how a restart against an already-migrated database is simulated.
	dataDir string
}

// instance is a booted server plus the HTTP plumbing needed to talk to it.
type instance struct {
	server  *server.Server
	profile *profile.Profile
	baseURL string
	client  *http.Client
}

// bootInstance starts a full server following the same sequence as
// cmd/memos/main.go: validate profile, open the driver, migrate, load
// deployment configuration, construct the server, then listen.
//
// Keep this in lockstep with main.go. The value of these tests comes from
// exercising the real startup path rather than a hand-assembled subset of it.
func bootInstance(ctx context.Context, t *testing.T, opts instanceOptions) *instance {
	t.Helper()

	dataDir := opts.dataDir
	if dataDir == "" {
		dataDir = t.TempDir()
	}

	instanceProfile := &profile.Profile{
		Demo:        opts.demo,
		Addr:        "127.0.0.1",
		Port:        unusedPort(t),
		Data:        dataDir,
		Driver:      "sqlite",
		InstanceURL: opts.instanceURL,
		RateLimit:   opts.rateLimit,
		Version:     version.GetCurrentVersion(),
		Commit:      version.Commit,
	}
	require.NoError(t, instanceProfile.Validate(), "profile should validate")

	dbDriver, err := db.NewDBDriver(instanceProfile)
	require.NoError(t, err, "should open database driver")

	storeInstance := store.New(dbDriver, instanceProfile)
	require.NoError(t, storeInstance.Migrate(ctx), "should migrate database")

	// main.go calls LoadDeploymentConfiguration, which scans the fixed
	// /etc/secrets path. Point the scan at a per-test directory so the result
	// cannot depend on host state; the missing-directory branch is identical.
	require.NoError(t, storeInstance.LoadDeploymentConfigurationDir(ctx, filepath.Join(dataDir, "secrets")),
		"should load deployment configuration")

	s, err := server.NewServer(ctx, instanceProfile, storeInstance)
	require.NoError(t, err, "should construct server")
	require.NoError(t, s.Start(), "should start server")

	inst := &instance{
		server:  s,
		profile: instanceProfile,
		baseURL: fmt.Sprintf("http://127.0.0.1:%d", instanceProfile.Port),
		client:  &http.Client{Timeout: 10 * time.Second},
	}
	t.Cleanup(func() {
		inst.shutdown(context.Background())
	})
	inst.waitUntilReady(t)
	return inst
}

// shutdown stops the server. Server.Shutdown also closes the store, so a
// subsequent boot against the same data directory must build a new driver,
// which is what bootInstance does and what a real restart does.
func (i *instance) shutdown(ctx context.Context) {
	if i.server == nil {
		return
	}
	i.server.Shutdown(ctx)
	i.server = nil
}

func (i *instance) waitUntilReady(t *testing.T) {
	t.Helper()
	require.Eventually(t, func() bool {
		resp, err := i.client.Get(i.baseURL + "/healthz")
		if err != nil {
			return false
		}
		defer resp.Body.Close()
		return resp.StatusCode == http.StatusOK
	}, 30*time.Second, 100*time.Millisecond, "server should become ready")
}

// do issues a request against the instance and returns the status and body.
func (i *instance) do(t *testing.T, method, path, token string, body any) (int, []byte) {
	t.Helper()

	var reader *bytes.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(encoded)
	} else {
		reader = bytes.NewReader(nil)
	}

	req, err := http.NewRequestWithContext(context.Background(), method, i.baseURL+path, reader)
	require.NoError(t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := i.client.Do(req)
	require.NoError(t, err, "%s %s should not fail at the transport level", method, path)
	defer resp.Body.Close()

	payload := new(bytes.Buffer)
	_, err = payload.ReadFrom(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, payload.Bytes()
}

// createAdmin registers the first user, which the service promotes to admin.
func (i *instance) createAdmin(t *testing.T) {
	t.Helper()

	status, body := i.do(t, http.MethodPost, "/api/v1/users", "", map[string]any{
		"username": testAdminUsername,
		"password": testAdminPassword,
		"email":    "startup-admin@example.test",
	})
	require.Equal(t, http.StatusOK, status, "creating the first user should succeed: %s", body)

	var created struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	require.NoError(t, json.Unmarshal(body, &created))
	require.Equal(t, testAdminUsername, created.Username)
	require.Equal(t, "ADMIN", created.Role, "the first user should be an admin")
}

// signIn authenticates as the admin created by createAdmin.
func (i *instance) signIn(t *testing.T) string {
	t.Helper()

	status, body := i.do(t, http.MethodPost, "/api/v1/auth/signin", "", map[string]any{
		"passwordCredentials": map[string]any{
			"username": testAdminUsername,
			"password": testAdminPassword,
		},
	})
	require.Equal(t, http.StatusOK, status, "sign-in should succeed: %s", body)

	var signedIn struct {
		AccessToken string `json:"accessToken"`
	}
	require.NoError(t, json.Unmarshal(body, &signedIn))
	require.NotEmpty(t, signedIn.AccessToken, "sign-in should return an access token")
	return signedIn.AccessToken
}

// createMemo writes a memo with a caller-supplied id so it can be re-read by name.
func (i *instance) createMemo(t *testing.T, token, memoID, content string) {
	t.Helper()

	status, body := i.do(t, http.MethodPost, "/api/v1/memos?memoId="+memoID, token, map[string]any{
		"content":    content,
		"visibility": "PRIVATE",
	})
	require.Equal(t, http.StatusOK, status, "creating a memo should succeed: %s", body)

	var created struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	require.NoError(t, json.Unmarshal(body, &created))
	require.Equal(t, "memos/"+memoID, created.Name)
	require.Equal(t, content, created.Content)
}

// requireMemo asserts a memo is readable and has the expected content.
func (i *instance) requireMemo(t *testing.T, token, memoID, content string) {
	t.Helper()

	status, body := i.do(t, http.MethodGet, "/api/v1/memos/"+memoID, token, nil)
	require.Equal(t, http.StatusOK, status, "reading memo %s should succeed: %s", memoID, body)

	var fetched struct {
		Content string `json:"content"`
	}
	require.NoError(t, json.Unmarshal(body, &fetched))
	require.Equal(t, content, fetched.Content)
}

func unusedPort(t *testing.T) int {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port
}

// TestStartupServesEveryRegisteredRouter boots a fresh instance and checks that
// each router mounted by server.NewServer actually answers. A registration
// order regression or a gateway conflict shows up here as a 404.
func TestStartupServesEveryRegisteredRouter(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{instanceURL: "http://localhost"})

	t.Run("healthz", func(t *testing.T) {
		status, body := inst.do(t, http.MethodGet, "/healthz", "", nil)
		require.Equal(t, http.StatusOK, status)
		require.Equal(t, "Service ready.", string(body))
	})

	t.Run("frontend", func(t *testing.T) {
		// CI only has the placeholder dist/index.html, so assert the route is
		// mounted and serving HTML rather than asserting on built markup.
		status, body := inst.do(t, http.MethodGet, "/", "", nil)
		require.Equal(t, http.StatusOK, status)
		require.Contains(t, strings.ToLower(string(body)), "<!doctype html>")
	})

	t.Run("api gateway", func(t *testing.T) {
		status, body := inst.do(t, http.MethodGet, "/api/v1/instance/profile", "", nil)
		require.Equal(t, http.StatusOK, status, "instance profile should be public: %s", body)
		require.Contains(t, string(body), "version")
	})

	t.Run("api gateway form post fallback", func(t *testing.T) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, inst.baseURL+"/api/v1/instance/profile", strings.NewReader(""))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		resp, err := inst.client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode, "public GET fallback should permit anonymous form posts")
	})

	t.Run("mcp", func(t *testing.T) {
		// A bare POST is enough to prove the handler is mounted; the MCP
		// protocol itself is covered by server/mcp tests.
		status, _ := inst.do(t, http.MethodPost, "/mcp", "", map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "tools/list",
		})
		require.NotEqual(t, http.StatusNotFound, status, "mcp route should be mounted")
	})
}

// TestStartupFreshInstallRoundTrip covers the new-install path end to end:
// register the first user, authenticate, then write and read a memo through
// the gRPC gateway.
func TestStartupFreshInstallRoundTrip(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{instanceURL: "http://localhost"})

	inst.createAdmin(t)
	token := inst.signIn(t)
	inst.createMemo(t, token, "startup-fresh", "fresh install sentinel")
	inst.requireMemo(t, token, "startup-fresh", "fresh install sentinel")
}

// TestStartupRestartPreservesData boots, writes data, shuts down, then boots a
// second time against the same data directory. This is the path every upgrade
// and every container restart takes, and it verifies migration is idempotent
// through the real startup sequence rather than through store.Migrate alone.
func TestStartupRestartPreservesData(t *testing.T) {
	ctx := context.Background()
	dataDir := t.TempDir()

	first := bootInstance(ctx, t, instanceOptions{
		instanceURL: "http://localhost",
		dataDir:     dataDir,
	})
	first.createAdmin(t)
	token := first.signIn(t)
	first.createMemo(t, token, "startup-restart", "written before restart")
	firstPort := first.profile.Port
	first.shutdown(ctx)

	second := bootInstance(ctx, t, instanceOptions{
		instanceURL: "http://localhost",
		dataDir:     dataDir,
	})
	require.NotEqual(t, firstPort, second.profile.Port, "the second boot should bind a new port")

	// Tokens are signed with the instance secret, which must survive a restart.
	restartToken := second.signIn(t)
	second.requireMemo(t, restartToken, "startup-restart", "written before restart")
	second.createMemo(t, restartToken, "startup-after-restart", "written after restart")
	second.requireMemo(t, restartToken, "startup-after-restart", "written after restart")
}

// TestStartupPrivateInstance verifies a private instance still exposes the auth
// bootstrap surface and refuses anonymous callers on non-bootstrap procedures.
func TestStartupPrivateInstanceGatewayPolicy(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{instanceURL: ""})

	inst.createAdmin(t)
	token := inst.signIn(t)
	inst.createMemo(t, token, "startup-private-public", "private on a private instance")
	status, body := inst.do(t, http.MethodPatch,
		"/api/v1/memos/startup-private-public?updateMask=visibility", token, map[string]any{
			"visibility": "PRIVATE",
		})
	require.Equal(t, http.StatusOK, status, "should be able to keep the memo private: %s", body)

	status, _ = inst.do(t, http.MethodGet, "/api/v1/memos", "", nil)
	require.Equal(t, http.StatusUnauthorized, status,
		"anonymous ListMemos over REST should be refused on a private instance")

	status, _ = inst.do(t, http.MethodGet, "/api/v1/memos/startup-private-public", "", nil)
	require.Equal(t, http.StatusUnauthorized, status,
		"anonymous GetMemo over REST should be refused on a private instance")
}

// TestStartupGatewayOmitsNullMessageFields checks the JSON the gateway actually
// puts on the wire against the contract the generated OpenAPI schema publishes.
// grpc-gateway's stock marshaler emits `"motionMedia": null` for a plain image
// attachment; the schema types that field as an object, so clients validating
// responses against it — MCP clients serve that schema as the tool outputSchema
// — reject every memo carrying an attachment. The marshaler override lives in
// RegisterGateway, so only a booted server proves it is wired in.
func TestStartupGatewayOmitsNullMessageFields(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{instanceURL: "http://localhost"})

	inst.createAdmin(t)
	token := inst.signIn(t)

	// A 1x1 GIF: small enough to inline, real enough for the type sniffing the
	// attachment service runs on upload.
	const onePixelGIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
	status, body := inst.do(t, http.MethodPost, "/api/v1/attachments", token, map[string]any{
		"filename": "pixel.gif",
		"type":     "image/gif",
		"content":  onePixelGIF,
	})
	require.Equal(t, http.StatusOK, status, "creating an attachment should succeed: %s", body)

	var created struct {
		Name string `json:"name"`
	}
	require.NoError(t, json.Unmarshal(body, &created))
	require.NotEmpty(t, created.Name, "the created attachment should carry a name: %s", body)

	status, body = inst.do(t, http.MethodGet, "/api/v1/"+created.Name, token, nil)
	require.Equal(t, http.StatusOK, status, "reading the attachment should succeed: %s", body)

	fetched := map[string]any{}
	require.NoError(t, json.Unmarshal(body, &fetched))
	require.NotContains(t, fetched, "motionMedia", "an unset message field must be omitted, not null: %s", body)
	// Scalar defaults still ship, so schema-required fields stay present.
	require.Equal(t, "", fetched["externalLink"])
	require.Equal(t, "pixel.gif", fetched["filename"])
	require.Equal(t, "image/gif", fetched["type"])
}

// TestStartupDemoMode verifies demo mode boots and seeds memos that an
// authenticated caller can list.
func TestStartupDemoMode(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{
		demo:        true,
		instanceURL: "http://localhost",
	})

	status, body := inst.do(t, http.MethodGet, "/api/v1/memos", "", nil)
	require.Equal(t, http.StatusUnauthorized, status, "anonymous callers cannot list memos: %s", body)

	status, body = inst.do(t, http.MethodGet, "/api/v1/memos", "memos_pat_demo", nil)
	require.Equal(t, http.StatusOK, status, "the demo access token should list seeded memos: %s", body)

	var listed struct {
		Memos []struct {
			Name string `json:"name"`
		} `json:"memos"`
	}
	require.NoError(t, json.Unmarshal(body, &listed))
	require.NotEmpty(t, listed.Memos, "demo mode should seed memos")
}
