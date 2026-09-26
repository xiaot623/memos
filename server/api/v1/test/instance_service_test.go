package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestGetInstanceProfile_Concurrency(t *testing.T) {
	ctx := context.Background()

	t.Run("Concurrent access to service", func(t *testing.T) {
		// Create test service for this specific test
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)

		// Make concurrent requests
		numGoroutines := 10
		results := make(chan *v1pb.InstanceProfile, numGoroutines)
		errors := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func() {
				req := &v1pb.GetInstanceProfileRequest{}
				resp, err := ts.Service.GetInstanceProfile(ctx, req)
				if err != nil {
					errors <- err
					return
				}
				results <- resp
			}()
		}

		// Collect all results
		for i := 0; i < numGoroutines; i++ {
			select {
			case err := <-errors:
				t.Fatalf("Goroutine returned error: %v", err)
			case resp := <-results:
				require.NotNil(t, resp)
				require.Equal(t, "test-1.0.0", resp.Version)
				require.Equal(t, "test-commit", resp.Commit)
				require.True(t, resp.Demo)
				require.Equal(t, "http://localhost:8080", resp.InstanceUrl)
				require.NotNil(t, resp.Admin)
			}
		}
	})
}
