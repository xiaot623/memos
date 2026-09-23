package vector

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pkg/errors"
)

const qdrantTimeout = 30 * time.Second

type qdrantStore struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func newQdrant(dsn string) (*qdrantStore, error) {
	baseURL, apiKey, err := parseQdrantDSN(dsn)
	if err != nil {
		return nil, err
	}
	store := &qdrantStore{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: qdrantTimeout},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := store.ping(ctx); err != nil {
		return nil, err
	}
	return store, nil
}

func parseQdrantDSN(dsn string) (string, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(dsn))
	if err != nil {
		return "", "", errors.Wrap(err, "invalid vector DSN")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", "", errors.New("vector DSN must use http or https")
	}
	if parsed.Host == "" {
		return "", "", errors.New("vector DSN must include a host")
	}
	apiKey := ""
	if parsed.User != nil {
		apiKey = parsed.User.Username()
		parsed.User = nil
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	return parsed.String(), apiKey, nil
}

func (s *qdrantStore) Close() error {
	s.httpClient.CloseIdleConnections()
	return nil
}

func (s *qdrantStore) ping(ctx context.Context) error {
	response, err := s.do(ctx, http.MethodGet, "/healthz", nil)
	if err != nil {
		return errors.Wrap(err, "failed to reach qdrant")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 512))
		return errors.Errorf("qdrant health check returned %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func (s *qdrantStore) EnsureCollection(ctx context.Context, dimensions int) error {
	if dimensions <= 0 {
		return errors.New("vector dimensions must be positive")
	}
	response, err := s.do(ctx, http.MethodGet, "/collections/"+CollectionName, nil)
	if err != nil {
		return errors.Wrap(err, "failed to read qdrant collection")
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return s.createCollection(ctx, dimensions)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return readQdrantError(response, "failed to read qdrant collection")
	}
	var decoded struct {
		Result struct {
			Config struct {
				Params struct {
					Vectors struct {
						Size int `json:"size"`
					} `json:"vectors"`
				} `json:"params"`
			} `json:"config"`
		} `json:"result"`
	}
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return errors.Wrap(err, "failed to decode qdrant collection")
	}
	if decoded.Result.Config.Params.Vectors.Size != dimensions {
		return errors.Wrapf(ErrDimensionMismatch, "collection has %d dimensions, embedding uses %d", decoded.Result.Config.Params.Vectors.Size, dimensions)
	}
	return nil
}

func (s *qdrantStore) createCollection(ctx context.Context, dimensions int) error {
	body := map[string]any{
		"vectors": map[string]any{
			"size":     dimensions,
			"distance": "Cosine",
		},
	}
	response, err := s.do(ctx, http.MethodPut, "/collections/"+CollectionName, body)
	if err != nil {
		return errors.Wrap(err, "failed to create qdrant collection")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return readQdrantError(response, "failed to create qdrant collection")
	}
	return nil
}

func (s *qdrantStore) Upsert(ctx context.Context, points []Point) error {
	if len(points) == 0 {
		return nil
	}
	encoded := make([]map[string]any, 0, len(points))
	for _, point := range points {
		encoded = append(encoded, map[string]any{
			"id":      point.ID,
			"vector":  point.Vector,
			"payload": payloadMap(point.Payload),
		})
	}
	response, err := s.do(ctx, http.MethodPut, "/collections/"+CollectionName+"/points?wait=true", map[string]any{
		"points": encoded,
	})
	if err != nil {
		return errors.Wrap(err, "failed to upsert qdrant points")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return readQdrantError(response, "failed to upsert qdrant points")
	}
	return nil
}

func (s *qdrantStore) SetPayload(ctx context.Context, ids []string, payload Payload) error {
	if len(ids) == 0 {
		return nil
	}
	response, err := s.do(ctx, http.MethodPost, "/collections/"+CollectionName+"/points/payload?wait=true", map[string]any{
		"payload": payloadMap(payload),
		"points":  ids,
	})
	if err != nil {
		return errors.Wrap(err, "failed to update qdrant payload")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return readQdrantError(response, "failed to update qdrant payload")
	}
	return nil
}

func (s *qdrantStore) Delete(ctx context.Context, filter Filter) error {
	body := map[string]any{}
	if encoded := filterMap(filter); encoded != nil {
		body["filter"] = encoded
	}
	response, err := s.do(ctx, http.MethodPost, "/collections/"+CollectionName+"/points/delete?wait=true", body)
	if err != nil {
		return errors.Wrap(err, "failed to delete qdrant points")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return readQdrantError(response, "failed to delete qdrant points")
	}
	return nil
}

func (s *qdrantStore) Search(ctx context.Context, vector []float32, limit, offset int, scoreThreshold float32, filter Filter) ([]Hit, error) {
	if limit <= 0 {
		return nil, nil
	}
	body := map[string]any{
		"vector":          vector,
		"limit":           limit,
		"offset":          offset,
		"with_payload":    true,
		"score_threshold": scoreThreshold,
	}
	if encoded := filterMap(filter); encoded != nil {
		body["filter"] = encoded
	}
	response, err := s.do(ctx, http.MethodPost, "/collections/"+CollectionName+"/points/search", body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to search qdrant")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, readQdrantError(response, "failed to search qdrant")
	}
	var decoded struct {
		Result []struct {
			ID      string         `json:"id"`
			Score   float32        `json:"score"`
			Payload map[string]any `json:"payload"`
		} `json:"result"`
	}
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return nil, errors.Wrap(err, "failed to decode qdrant search response")
	}
	hits := make([]Hit, 0, len(decoded.Result))
	for _, result := range decoded.Result {
		hits = append(hits, Hit{
			ID:      result.ID,
			Score:   result.Score,
			Payload: payloadFromMap(result.Payload),
		})
	}
	return hits, nil
}

func (s *qdrantStore) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, errors.Wrap(err, "failed to encode qdrant request")
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, s.baseURL+path, reader)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create qdrant request")
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if s.apiKey != "" {
		request.Header.Set("api-key", s.apiKey)
	}
	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, errors.Wrap(err, "qdrant request failed")
	}
	return response, nil
}

func readQdrantError(response *http.Response, message string) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
	return errors.Errorf("%s: status %d: %s", message, response.StatusCode, strings.TrimSpace(string(body)))
}

func payloadMap(payload Payload) map[string]any {
	return map[string]any{
		"memo_id":       payload.MemoID,
		"creator_id":    payload.CreatorID,
		"space_id":      payload.SpaceID,
		"visibility":    payload.Visibility,
		"row_status":    payload.RowStatus,
		"attachment_id": payload.AttachmentID,
	}
}

func payloadFromMap(raw map[string]any) Payload {
	return Payload{
		MemoID:       jsonInt32(raw["memo_id"]),
		CreatorID:    jsonInt32(raw["creator_id"]),
		SpaceID:      jsonInt32(raw["space_id"]),
		Visibility:   jsonString(raw["visibility"]),
		RowStatus:    jsonString(raw["row_status"]),
		AttachmentID: jsonInt32(raw["attachment_id"]),
	}
}

func filterMap(filter Filter) map[string]any {
	must := make([]any, 0, 4)
	if filter.MemoID != nil {
		must = append(must, matchCondition("memo_id", *filter.MemoID))
	}
	if filter.CreatorID != nil {
		must = append(must, matchCondition("creator_id", *filter.CreatorID))
	}
	if filter.AttachmentID != nil {
		must = append(must, matchCondition("attachment_id", *filter.AttachmentID))
	}
	if filter.RowStatus != "" {
		must = append(must, map[string]any{
			"key":   "row_status",
			"match": map[string]any{"value": filter.RowStatus},
		})
	}
	if len(must) == 0 {
		return nil
	}
	return map[string]any{"must": must}
}

func matchCondition(key string, value int32) map[string]any {
	return map[string]any{
		"key":   key,
		"match": map[string]any{"value": value},
	}
}

func jsonInt32(value any) int32 {
	switch typed := value.(type) {
	case float64:
		return int32(typed)
	case json.Number:
		parsed, _ := typed.Int64()
		return int32(parsed)
	default:
		return 0
	}
}

func jsonString(value any) string {
	text, _ := value.(string)
	return text
}
