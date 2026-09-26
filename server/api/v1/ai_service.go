package v1

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/embed"
	"github.com/usememos/memos/store"
)

// ListEmbeddingModels returns embedding models for one configured provider.
func (s *APIV1Service) ListEmbeddingModels(ctx context.Context, request *v1pb.ListEmbeddingModelsRequest) (*v1pb.ListEmbeddingModelsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if user.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	providerID := strings.TrimSpace(request.ProviderId)
	if providerID == "" {
		return nil, status.Errorf(codes.InvalidArgument, "provider_id is required")
	}
	setting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}
	provider, err := s.resolveAIProvider(setting, providerID)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "provider is not configured")
	}
	if provider.Type != ai.ProviderOpenAI && provider.Type != ai.ProviderOpenRouter {
		return nil, status.Errorf(codes.InvalidArgument, "provider type %q does not support embedding model lists", provider.Type)
	}
	models, err := (&embed.Client{Endpoint: provider.Endpoint, APIKey: provider.APIKey}).ListEmbeddingModels(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list embedding models: %v", err)
	}
	response := &v1pb.ListEmbeddingModelsResponse{Models: make([]*v1pb.EmbeddingModel, 0, len(models))}
	for _, model := range models {
		response.Models = append(response.Models, &v1pb.EmbeddingModel{Id: model.ID, Title: model.Title})
	}
	return response, nil
}

func (*APIV1Service) resolveAIProvider(setting *storepb.InstanceAISetting, providerID string) (ai.ProviderConfig, error) {
	providers := make([]ai.ProviderConfig, 0, len(setting.GetProviders()))
	for _, provider := range setting.GetProviders() {
		if provider == nil {
			continue
		}
		providers = append(providers, convertAIProviderConfigFromStore(provider))
	}

	provider, err := ai.FindProvider(providers, providerID)
	if err != nil {
		return ai.ProviderConfig{}, status.Errorf(codes.FailedPrecondition, "embedding provider is not configured")
	}
	return *provider, nil
}

func convertAIProviderConfigFromStore(provider *storepb.AIProviderConfig) ai.ProviderConfig {
	return ai.ProviderConfig{
		ID:       provider.GetId(),
		Title:    provider.GetTitle(),
		Type:     convertAIProviderTypeFromStore(provider.GetType()),
		Endpoint: provider.GetEndpoint(),
		APIKey:   provider.GetApiKey(),
	}
}

func convertAIProviderTypeFromStore(providerType storepb.AIProviderType) ai.ProviderType {
	switch providerType {
	case storepb.AIProviderType_OPENAI:
		return ai.ProviderOpenAI
	case storepb.AIProviderType_GEMINI:
		return ai.ProviderGemini
	case storepb.AIProviderType_OPENROUTER:
		return ai.ProviderOpenRouter
	default:
		return ""
	}
}
