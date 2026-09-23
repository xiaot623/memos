package embed

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEmbedTextAndImage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/embeddings", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		_, _ = w.Write([]byte(`{"data":[{"embedding":[0.25,0.5]}]}`))
	}))
	t.Cleanup(server.Close)

	client := &Client{
		Endpoint:   server.URL,
		APIKey:     "test-key",
		Model:      "google/gemini-embedding-2",
		Dimensions: 2,
	}
	vectors, err := client.Embed(context.Background(), []Input{{Text: "hello"}, {Image: []byte{1, 2}, ImageMIME: "image/png"}})
	require.NoError(t, err)
	require.Equal(t, [][]float32{{0.25, 0.5}, {0.25, 0.5}}, vectors)
}

func TestListEmbeddingModelsFiltersModalities(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/models", r.URL.Path)
		_, _ = w.Write([]byte(`{"data":[
			{"id":"google/gemini-embedding-2","name":"Gemini Embedding 2","architecture":{"output_modalities":["embeddings"]}},
			{"id":"google/gemini-flash","name":"Flash","architecture":{"output_modalities":["text"]}},
			{"id":"text-embedding-3-small","name":"Small"}
		]}`))
	}))
	t.Cleanup(server.Close)

	models, err := (&Client{Endpoint: server.URL}).ListEmbeddingModels(context.Background())
	require.NoError(t, err)
	require.Equal(t, []Model{
		{ID: "google/gemini-embedding-2", Title: "Gemini Embedding 2"},
		{ID: "text-embedding-3-small", Title: "Small"},
	}, models)
}
