package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	memosproto "github.com/usememos/memos/proto"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestIsAllowedMCPOrigin(t *testing.T) {
	profile := &profile.Profile{InstanceURL: "https://memos.example.com/app"}

	tests := []struct {
		name   string
		host   string
		origin string
		want   bool
	}{
		{name: "empty origin", host: "localhost:5230", origin: "", want: true},
		{name: "same http host", host: "localhost:5230", origin: "http://localhost:5230", want: true},
		{name: "same https host", host: "memos.example.com", origin: "https://memos.example.com", want: true},
		{name: "configured instance URL origin", host: "127.0.0.1:5230", origin: "https://memos.example.com", want: true},
		{name: "configured instance URL ignores path", host: "127.0.0.1:5230", origin: "https://memos.example.com", want: true},
		{name: "different host", host: "localhost:5230", origin: "https://evil.example.com", want: false},
		{name: "invalid origin", host: "localhost:5230", origin: "not a url", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, isAllowedMCPOrigin(test.host, test.origin, profile))
		})
	}
}

func TestNewMCPServiceRegistersCuratedTools(t *testing.T) {
	echoServer := echo.New()

	service := newTestMCPService(t, echoServer)
	require.NotNil(t, service.handler)
	require.Len(t, service.operationsByTool, len(curatedOperationIDs))

	operation := service.operationsByTool["memo_list_memos"]
	require.NotNil(t, operation)
	require.Equal(t, "MemoService_ListMemos", operation.OperationID)
	require.Equal(t, "GET", operation.Method)
	require.Equal(t, "/api/v1/memos", operation.Path)
}

func TestNewMCPServiceUsesEmbeddedOpenAPISpec(t *testing.T) {
	t.Chdir(t.TempDir())

	service := newTestMCPService(t, echo.New())
	require.NotNil(t, service.handler)
	require.Len(t, service.operationsByTool, len(curatedOperationIDs))
}

func TestEmbeddedOpenAPISpecMatchesGeneratedFile(t *testing.T) {
	generated, err := os.ReadFile("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	require.Equal(t, generated, memosproto.OpenAPIYAML())
}

func TestMCPToolHandlerForwardsArgumentsAndAuthorization(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		require.Equal(t, "Bearer token", c.Request().Header.Get("Authorization"))
		require.Equal(t, "7", c.QueryParam("pageSize"))
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/test"}},
		})
	})

	operation := &registeredOperation{
		Operation: &openAPIOperation{
			Method:     "GET",
			Path:       "/api/v1/memos",
			Parameters: []openAPIParameter{{Name: "pageSize", In: "query", Schema: jsonSchema{"type": "integer"}}},
		},
	}
	handler := newMCPToolHandler(newAPIAdapter(echoServer), operation)
	arguments, err := json.Marshal(map[string]any{"pageSize": 7})
	require.NoError(t, err)

	result, err := handler(context.Background(), &sdkmcp.CallToolRequest{
		Params: &sdkmcp.CallToolParamsRaw{
			Name:      "memo_list_memos",
			Arguments: arguments,
		},
		Extra: &sdkmcp.RequestExtra{
			Header: http.Header{"Authorization": []string{"Bearer token"}},
		},
	})
	require.NoError(t, err)
	require.False(t, result.IsError)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/test"}},
	}, result.StructuredContent)
}

func TestMCPProtocolListsCuratedToolsOnly(t *testing.T) {
	echoServer := echo.New()

	service := newTestMCPService(t, echoServer)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)
	response := postMCP(t, echoServer, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
	})

	result, ok := response["result"].(map[string]any)
	require.True(t, ok)
	tools, ok := result["tools"].([]any)
	require.True(t, ok)
	require.Len(t, tools, len(curatedOperationIDs))

	names := map[string]struct{}{}
	for _, rawTool := range tools {
		tool, ok := rawTool.(map[string]any)
		require.True(t, ok)
		name, ok := tool["name"].(string)
		require.True(t, ok)
		names[name] = struct{}{}
		require.Contains(t, tool, "inputSchema")
		require.Contains(t, tool, "outputSchema")
	}
	require.Contains(t, names, "memo_list_memos")
	require.Contains(t, names, "memo_create_memo")
	require.NotContains(t, names, "auth_sign_in")
	require.NotContains(t, names, "user_create_user")
}

func TestMCPToolCallReturnsObjectStructuredContent(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/abc123"}},
		})
	})

	service := newTestMCPService(t, echoServer)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)
	response := postMCP(t, echoServer, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "memo_list_memos",
			"arguments": map[string]any{
				"pageSize": 1,
			},
		},
	})

	result, ok := response["result"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/abc123"}},
	}, result["structuredContent"])
}

func TestMCPToolCallAllowsGatewayToInferMemoUpdateMask(t *testing.T) {
	echoServer := echo.New()
	routeHits := 0
	echoServer.PATCH("/api/v1/memos/:memo", func(c *echo.Context) error {
		routeHits++
		require.Equal(t, "abc123", c.Param("memo"))
		require.Empty(t, c.QueryParam("updateMask"))

		body := map[string]any{}
		require.NoError(t, json.NewDecoder(c.Request().Body).Decode(&body))
		require.Equal(t, map[string]any{"content": "updated"}, body)
		return c.JSON(http.StatusOK, map[string]any{
			"name":    "memos/abc123",
			"content": "updated",
		})
	})

	service := newTestMCPService(t, echoServer)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)
	response := postMCP(t, echoServer, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "memo_update_memo",
			"arguments": map[string]any{
				"memo": "memos/abc123",
				"body": map[string]any{"content": "updated"},
			},
		},
	})

	result, ok := response["result"].(map[string]any)
	require.True(t, ok)
	require.NotEqual(t, true, result["isError"])
	require.Equal(t, map[string]any{
		"name":    "memos/abc123",
		"content": "updated",
	}, result["structuredContent"])
	require.Equal(t, 1, routeHits)
}

func TestMCPToolCallBindsMemoFromPathForBodyStarOperations(t *testing.T) {
	register := func(e *echo.Echo, method, path string, handler func(*echo.Context) error) {
		switch method {
		case http.MethodPatch:
			e.PATCH(path, handler)
		case http.MethodPost:
			e.POST(path, handler)
		default:
			t.Fatalf("unsupported method %q", method)
		}
	}

	tests := []struct {
		name     string
		method   string
		path     string
		toolName string
		body     map[string]any
		response map[string]any
	}{
		{
			name:     "set attachments",
			method:   http.MethodPatch,
			path:     "/api/v1/memos/:memo/attachments",
			toolName: "memo_set_memo_attachments",
			body:     map[string]any{"attachments": []any{}},
			response: map[string]any{},
		},
		{
			name:     "set relations",
			method:   http.MethodPatch,
			path:     "/api/v1/memos/:memo/relations",
			toolName: "memo_set_memo_relations",
			body:     map[string]any{"relations": []any{}},
			response: map[string]any{},
		},
		{
			name:     "upsert reaction",
			method:   http.MethodPost,
			path:     "/api/v1/memos/:memo/reactions",
			toolName: "memo_upsert_memo_reaction",
			body: map[string]any{
				"reaction": map[string]any{
					"contentId":    "memos/abc123",
					"reactionType": "👍",
				},
			},
			response: map[string]any{"reactionType": "👍"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			echoServer := echo.New()
			routeHits := 0
			register(echoServer, test.method, test.path, func(c *echo.Context) error {
				routeHits++
				// The memo must be bound from the path, and the omitted "name"
				// property must not reappear in the forwarded body.
				require.Equal(t, "abc123", c.Param("memo"))
				body := map[string]any{}
				require.NoError(t, json.NewDecoder(c.Request().Body).Decode(&body))
				require.NotContains(t, body, "name")
				return c.JSON(http.StatusOK, test.response)
			})

			service := newTestMCPService(t, echoServer)
			service.RegisterRoutes(echoServer)

			initializeMCP(t, echoServer)
			response := postMCP(t, echoServer, map[string]any{
				"jsonrpc": "2.0",
				"id":      2,
				"method":  "tools/call",
				"params": map[string]any{
					"name": test.toolName,
					"arguments": map[string]any{
						"memo": "memos/abc123",
						"body": test.body,
					},
				},
			})

			result, ok := response["result"].(map[string]any)
			require.True(t, ok)
			require.NotEqual(t, true, result["isError"], result)
			require.Equal(t, 1, routeHits)
		})
	}
}

func TestMCPToolCallRejectsInvalidArguments(t *testing.T) {
	echoServer := echo.New()
	routeHits := 0
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		routeHits++
		return c.JSON(http.StatusOK, map[string]any{"memos": []any{}})
	})
	echoServer.GET("/api/v1/memos/:memo", func(c *echo.Context) error {
		routeHits++
		return c.JSON(http.StatusOK, map[string]any{"name": c.Param("memo")})
	})

	service := newTestMCPService(t, echoServer)
	service.RegisterRoutes(echoServer)

	initializeMCP(t, echoServer)

	tests := []struct {
		name      string
		toolName  string
		arguments map[string]any
		wantError string
	}{
		{
			name:      "unknown argument",
			toolName:  "memo_list_memos",
			arguments: map[string]any{"unexpected": true},
			wantError: `unknown argument "unexpected"`,
		},
		{
			name:      "missing required argument",
			toolName:  "memo_get_memo",
			arguments: map[string]any{},
			wantError: `missing required argument "memo"`,
		},
		{
			name:      "wrong primitive type",
			toolName:  "memo_list_memos",
			arguments: map[string]any{"pageSize": "ten"},
			wantError: `argument "pageSize" must be integer`,
		},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := postMCP(t, echoServer, map[string]any{
				"jsonrpc": "2.0",
				"id":      index + 2,
				"method":  "tools/call",
				"params": map[string]any{
					"name":      test.toolName,
					"arguments": test.arguments,
				},
			})

			result, ok := response["result"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, true, result["isError"])
			// Error results carry no structuredContent — it would fail
			// validation against the tool's declared outputSchema in strict
			// clients. The message travels in the text content instead.
			_, hasStructured := result["structuredContent"]
			require.False(t, hasStructured)
			content, ok := result["content"].([]any)
			require.True(t, ok)
			require.NotEmpty(t, content)
			textBlock, ok := content[0].(map[string]any)
			require.True(t, ok)
			require.Contains(t, textBlock["text"], test.wantError)
		})
	}
	require.Zero(t, routeHits)
}

// TestMCPLoopbackBehindReverseProxy verifies that a loopback-bound instance
// served under a non-loopback Host (the reverse-proxy deployment shape) is no
// longer rejected by the SDK's DNS-rebinding guard, while memos' own Origin
// allowlist still rejects disallowed origins.
func TestMCPLoopbackBehindReverseProxy(t *testing.T) {
	echoServer := echo.New()
	service := newTestMCPService(t, echoServer)
	service.RegisterRoutes(echoServer)

	initialize, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities":    map[string]any{},
			"clientInfo":      map[string]any{"name": "memos-test", "version": "1.0.0"},
		},
	})
	require.NoError(t, err)

	// Simulate the proxied deployment: the connection terminates on a loopback
	// address, but the public Host header is a real domain.
	newRequest := func() *http.Request {
		request := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(initialize))
		request.Host = "demo.usememos.com"
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Accept", "application/json, text/event-stream")
		loopback := &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 5230}
		ctx := context.WithValue(request.Context(), http.LocalAddrContextKey, loopback)
		return request.WithContext(ctx)
	}

	t.Run("allows non-loopback host with no origin", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		echoServer.ServeHTTP(recorder, newRequest())
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	})

	t.Run("still rejects a disallowed origin", func(t *testing.T) {
		request := newRequest()
		request.Header.Set("Origin", "https://evil.example.com")
		recorder := httptest.NewRecorder()
		echoServer.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusForbidden, recorder.Code)
	})
}

func TestMCPSecretURLRejectsInvalidPAT(t *testing.T) {
	ctx := context.Background()
	ts := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() { _ = ts.Close() })

	echoServer := echo.New()
	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer, ts, "test-secret")
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)

	payload := mcpInitializePayload()
	data, err := json.Marshal(payload)
	require.NoError(t, err)

	tests := []struct {
		name string
		path string
	}{
		{name: "not a PAT", path: "/mcp/s/not-a-pat"},
		{name: "unknown PAT", path: "/mcp/s/memos_pat_unknown"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, test.path, bytes.NewReader(data))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Accept", "application/json, text/event-stream")
			request.Header.Set("Origin", "https://gemini.google.com")
			recorder := httptest.NewRecorder()
			echoServer.ServeHTTP(recorder, request)
			require.Equal(t, http.StatusUnauthorized, recorder.Code)
		})
	}
}

func TestMCPSecretURLAuthenticatesPATAndAllowsForeignOrigin(t *testing.T) {
	ctx := context.Background()
	ts := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() { _ = ts.Close() })

	user, err := ts.CreateUser(ctx, &store.User{
		Username:     "mcp-pat-user",
		Role:         store.RoleUser,
		Email:        "mcp-pat-user@test.com",
		Nickname:     "mcp-pat-user",
		PasswordHash: "unused",
	})
	require.NoError(t, err)

	pat := auth.GeneratePersonalAccessToken()
	require.NoError(t, ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-mcp-1",
		TokenHash:   auth.HashPersonalAccessToken(pat),
		Description: "mcp secret url",
		CreatedAt:   timestamppb.Now(),
	}))

	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		require.Equal(t, "Bearer "+pat, c.Request().Header.Get("Authorization"))
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/from-pat"}},
		})
	})

	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer, ts, "test-secret")
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)

	path := "/mcp/s/" + pat
	initializeMCPAt(t, echoServer, path, "https://gemini.google.com")
	response := postMCPAt(t, echoServer, path, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "memo_list_memos",
			"arguments": map[string]any{
				"pageSize": 1,
			},
		},
	}, "https://gemini.google.com")

	result, ok := response["result"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/from-pat"}},
	}, result["structuredContent"])
}

func newTestMCPService(t *testing.T, echoServer *echo.Echo) *MCPService {
	t.Helper()
	service, err := NewMCPService(&profile.Profile{Version: "test-version"}, echoServer, nil, "")
	require.NoError(t, err)
	return service
}

func mcpInitializePayload() map[string]any {
	return map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities":    map[string]any{},
			"clientInfo": map[string]any{
				"name":    "memos-test",
				"version": "1.0.0",
			},
		},
	}
}

func initializeMCP(t *testing.T, echoServer *echo.Echo) {
	t.Helper()
	initializeMCPAt(t, echoServer, "/mcp", "")
}

func initializeMCPAt(t *testing.T, echoServer *echo.Echo, path string, origin string) {
	t.Helper()
	response := postMCPAt(t, echoServer, path, mcpInitializePayload(), origin)
	require.NotNil(t, response["result"])
}

func postMCP(t *testing.T, echoServer *echo.Echo, payload map[string]any) map[string]any {
	t.Helper()
	return postMCPAt(t, echoServer, "/mcp", payload, "")
}

func postMCPAt(t *testing.T, echoServer *echo.Echo, path string, payload map[string]any, origin string) map[string]any {
	t.Helper()
	data, err := json.Marshal(payload)
	require.NoError(t, err)

	request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	if origin != "" {
		request.Header.Set("Origin", origin)
	}

	recorder := httptest.NewRecorder()
	echoServer.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var response map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}
