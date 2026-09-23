package vector

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseQdrantDSNStripsAPIKey(t *testing.T) {
	baseURL, apiKey, err := parseQdrantDSN("http://secret@127.0.0.1:6333/extra/")
	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:6333/extra", baseURL)
	require.Equal(t, "secret", apiKey)
}

func TestQdrantEnsureSearchAndDelete(t *testing.T) {
	var created bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "secret", r.Header.Get("api-key"))
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/healthz":
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodGet && r.URL.Path == "/collections/memos":
			if !created {
				http.NotFound(w, r)
				return
			}
			_, _ = w.Write([]byte(`{"result":{"config":{"params":{"vectors":{"size":4,"distance":"Cosine"}}}}}`))
		case r.Method == http.MethodPut && r.URL.Path == "/collections/memos":
			created = true
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPut && r.URL.Path == "/collections/memos/points":
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPost && r.URL.Path == "/collections/memos/points/search":
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			var request map[string]any
			require.NoError(t, json.Unmarshal(body, &request))
			require.EqualValues(t, 2, request["limit"])
			require.EqualValues(t, 0.5, request["score_threshold"])
			_, _ = w.Write([]byte(`{"result":[{"id":"abc","score":0.9,"payload":{"memo_id":7,"creator_id":3,"space_id":0,"visibility":"PRIVATE","row_status":"NORMAL","attachment_id":0}}]}`))
		case r.Method == http.MethodPost && r.URL.Path == "/collections/memos/points/delete":
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	store, err := newQdrant("http://secret@" + server.Listener.Addr().String())
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, store.Close()) })

	ctx := context.Background()
	require.NoError(t, store.EnsureCollection(ctx, 4))
	require.NoError(t, store.Upsert(ctx, []Point{{
		ID:     PointID(7, 0),
		Vector: []float32{1, 0, 0, 0},
		Payload: Payload{
			MemoID:     7,
			CreatorID:  3,
			Visibility: "PRIVATE",
			RowStatus:  "NORMAL",
		},
	}}))
	hits, err := store.Search(ctx, []float32{1, 0, 0, 0}, 2, 0, 0.5, Filter{})
	require.NoError(t, err)
	require.Equal(t, []Hit{{
		ID:    "abc",
		Score: 0.9,
		Payload: Payload{
			MemoID:     7,
			CreatorID:  3,
			Visibility: "PRIVATE",
			RowStatus:  "NORMAL",
		},
	}}, hits)
	creatorID := int32(3)
	require.NoError(t, store.Delete(ctx, Filter{CreatorID: &creatorID}))

	require.ErrorIs(t, store.EnsureCollection(ctx, 8), ErrDimensionMismatch)
}
