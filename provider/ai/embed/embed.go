package embed

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pkg/errors"
)

const (
	// DefaultDimensions is the vector size used when configuration leaves it unset.
	DefaultDimensions = 768
	// DefaultOpenRouterEndpoint is the OpenAI-compatible OpenRouter base URL.
	DefaultOpenRouterEndpoint = "https://openrouter.ai/api/v1"
)

// Input is one text string or one image. Exactly one of Text or Image is set.
type Input struct {
	Text      string
	Image     []byte
	ImageMIME string
}

// Model is an embedding model advertised by a provider.
type Model struct {
	ID    string
	Title string
}

// Client calls an OpenAI-compatible embeddings API.
type Client struct {
	Endpoint   string
	APIKey     string
	Model      string
	Dimensions int
	HTTPClient *http.Client
}

// Embed returns one vector per input, in order.
func (c *Client) Embed(ctx context.Context, inputs []Input) ([][]float32, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	vectors := make([][]float32, 0, len(inputs))
	for _, input := range inputs {
		vector, err := c.embedOne(ctx, input)
		if err != nil {
			return nil, err
		}
		vectors = append(vectors, vector)
	}
	return vectors, nil
}

func (c *Client) embedOne(ctx context.Context, input Input) ([]float32, error) {
	payload, err := embeddingPayload(input)
	if err != nil {
		return nil, err
	}
	body := map[string]any{
		"model": c.Model,
		"input": payload,
	}
	if c.Dimensions > 0 {
		body["dimensions"] = c.Dimensions
	}
	var decoded struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := c.post(ctx, "/embeddings", body, &decoded); err != nil {
		return nil, err
	}
	if decoded.Error != nil && decoded.Error.Message != "" {
		return nil, errors.Errorf("embedding provider: %s", decoded.Error.Message)
	}
	if len(decoded.Data) == 0 || len(decoded.Data[0].Embedding) == 0 {
		return nil, errors.New("embedding provider returned no vector")
	}
	return decoded.Data[0].Embedding, nil
}

func embeddingPayload(input Input) (any, error) {
	if len(input.Image) > 0 {
		if input.ImageMIME == "" {
			return nil, errors.New("image embedding requires a MIME type")
		}
		return []map[string]any{{
			"type": "image_url",
			"image_url": map[string]any{
				"url": "data:" + input.ImageMIME + ";base64," + base64.StdEncoding.EncodeToString(input.Image),
			},
		}}, nil
	}
	return input.Text, nil
}

// ListEmbeddingModels returns models whose catalog entry is an embedding model.
func (c *Client) ListEmbeddingModels(ctx context.Context) ([]Model, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint("/models"), nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create model list request")
	}
	if c.APIKey != "" {
		request.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	response, err := c.client().Do(request)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list embedding models")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read model list")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, errors.Errorf("model list returned %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	var decoded struct {
		Data []struct {
			ID           string `json:"id"`
			Name         string `json:"name"`
			Architecture struct {
				OutputModalities []string `json:"output_modalities"`
			} `json:"architecture"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, errors.Wrap(err, "failed to decode model list")
	}
	models := make([]Model, 0)
	for _, item := range decoded.Data {
		if item.ID == "" || !isEmbeddingModel(item.ID, item.Architecture.OutputModalities) {
			continue
		}
		title := item.Name
		if title == "" {
			title = item.ID
		}
		models = append(models, Model{ID: item.ID, Title: title})
	}
	return models, nil
}

func isEmbeddingModel(id string, outputModalities []string) bool {
	if len(outputModalities) > 0 {
		for _, modality := range outputModalities {
			if strings.EqualFold(modality, "embeddings") || strings.EqualFold(modality, "embedding") {
				return true
			}
		}
		return false
	}
	return strings.Contains(strings.ToLower(id), "embed")
}

func (c *Client) post(ctx context.Context, path string, body any, dest any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return errors.Wrap(err, "failed to encode embedding request")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint(path), bytes.NewReader(encoded))
	if err != nil {
		return errors.Wrap(err, "failed to create embedding request")
	}
	request.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		request.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	response, err := c.client().Do(request)
	if err != nil {
		return errors.Wrap(err, "embedding request failed")
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return errors.Wrap(err, "failed to read embedding response")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return errors.Errorf("embedding request returned %d: %s", response.StatusCode, strings.TrimSpace(string(raw)))
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		return errors.Wrap(err, "failed to decode embedding response")
	}
	return nil
}

func (c *Client) endpoint(path string) string {
	return strings.TrimRight(c.Endpoint, "/") + path
}

func (c *Client) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 60 * time.Second}
}
