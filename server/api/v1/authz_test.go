package v1

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

type stubAnonymousAccessStore struct {
	allowsAnonymous bool
	err             error
}

func (s stubAnonymousAccessStore) AllowsAnonymousAccess(context.Context) (bool, error) {
	return s.allowsAnonymous, s.err
}

func TestWriteGatewayAuthorizationErrorMapsFailureClass(t *testing.T) {
	unauthenticated := httptest.NewRecorder()
	writeGatewayAuthorizationError(unauthenticated, ErrUnauthenticated)
	assert.Equal(t, http.StatusUnauthorized, unauthenticated.Code)

	internal := httptest.NewRecorder()
	writeGatewayAuthorizationError(internal, errors.New("database unavailable"))
	assert.Equal(t, http.StatusInternalServerError, internal.Code)
	assert.NotContains(t, internal.Body.String(), "database unavailable")
}

// TestAuthorizerCheckAccess exercises the method-level access policy matrix.
