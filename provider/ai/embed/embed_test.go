package embed

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEmbedTextAndImage(t *testing.T) {
	var bodies [][]byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/embeddings", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		bodies = append(bodies, body)
		_, _ = w.Write([]byte(`{"data":[{"embedding":[0.25,0.5]}]}`))
	}))
	t.Cleanup(server.Close)

	client := &Client{
		Endpoint:   server.URL,
		APIKey:     "test-key",
		Model:      "google/gemini-embedding-2",
		Dimensions: 2,
	}
	image := []byte{1, 2}
	vectors, err := client.Embed(context.Background(), []Input{{Text: "hello"}, {Image: image, ImageMIME: "image/png"}})
	require.NoError(t, err)
	require.Equal(t, [][]float32{{0.25, 0.5}, {0.25, 0.5}}, vectors)
	require.Len(t, bodies, 2)

	var textRequest struct {
		Input any `json:"input"`
	}
	require.NoError(t, json.Unmarshal(bodies[0], &textRequest))
	require.Equal(t, "hello", textRequest.Input)

	var imageRequest struct {
		Input []struct {
			Content []struct {
				Type     string `json:"type"`
				ImageURL struct {
					URL string `json:"url"`
				} `json:"image_url"`
			} `json:"content"`
		} `json:"input"`
	}
	require.NoError(t, json.Unmarshal(bodies[1], &imageRequest))
	require.Len(t, imageRequest.Input, 1)
	require.Len(t, imageRequest.Input[0].Content, 1)
	part := imageRequest.Input[0].Content[0]
	require.Equal(t, "image_url", part.Type)
	require.Equal(t, "data:image/png;base64,"+base64.StdEncoding.EncodeToString(image), part.ImageURL.URL)
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
