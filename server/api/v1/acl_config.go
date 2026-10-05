package v1

// PublicMethods defines API endpoints that don't require authentication.
// All other endpoints require a valid session or access token.
//
// This is the SINGLE SOURCE OF TRUTH for public endpoints.
// Both Connect interceptor and gRPC-Gateway interceptor use this map.
//
// Format: Full gRPC procedure path as returned by req.Spec().Procedure (Connect)
// or info.FullMethod (gRPC interceptor).
//
// Anonymous callers may reach auth/bootstrap endpoints, read PUBLIC memos
// (list, get, and the author profile on those cards), and open share-token links.
var PublicMethods = map[string]struct{}{
	// Auth Service - login/token endpoints must be accessible without auth
	"/memos.api.v1.AuthService/SignIn":       {},
	"/memos.api.v1.AuthService/RefreshToken": {}, // Token refresh uses cookie, must be accessible when access token expired

	// Instance Service - needed before login to show instance info
	"/memos.api.v1.InstanceService/GetInstanceProfile":       {},
	"/memos.api.v1.InstanceService/GetInstanceSetting":       {},
	"/memos.api.v1.InstanceService/BatchGetInstanceSettings": {},

	// User Service - registration policy is enforced in UserService.
	// GetUser returns a public profile; email stays hidden from other viewers.
	"/memos.api.v1.UserService/CreateUser": {},
	"/memos.api.v1.UserService/GetUser":    {},

	// Memo reads. Handlers still apply the audience predicate, so anonymous
	// callers only receive normal PUBLIC memos.
	"/memos.api.v1.MemoService/ListMemos": {},
	"/memos.api.v1.MemoService/GetMemo":   {},

	// Memo sharing - share-token endpoints require no authentication
	"/memos.api.v1.MemoService/GetSharedMemo": {},
}

// IsPublicMethod checks if a procedure path is public (no authentication required).
// Returns true for public methods, false for protected methods.
func IsPublicMethod(procedure string) bool {
	_, ok := PublicMethods[procedure]
	return ok
}
