import { ROUTES } from "@/router/routes";

/** Query parameter used to preserve the intended destination across the auth flow. */
export const AUTH_REDIRECT_PARAM = "redirect";

/** Query parameter used to surface why the user was sent to the auth page. */
export const AUTH_REASON_PARAM = "reason";

/** Reason code signalling that the user hit a memo that requires authentication. */
export const AUTH_REASON_PROTECTED_MEMO = "protected-memo";

/**
 * Validates a post-authentication redirect target.
 *
 * Returns the path when it is a safe same-origin internal destination, otherwise `undefined`.
 * Rejected targets include: non-string / empty, protocol-relative URLs (`//host`), absolute URLs,
 * and any auth-family route (`/auth`, `/auth/callback`, …) which must not be a landing target
 * after sign-in.
 */
export function getSafeRedirectPath(path: string | null | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  if (!path.startsWith("/") || path.startsWith("//")) {
    return undefined;
  }

  // Never let a redirect target point back into the auth flow — it would either
  // bounce the user in a guest/auth guard loop or hijack the OAuth callback.
  if (path === ROUTES.AUTH || path.startsWith(`${ROUTES.AUTH}/`) || path.startsWith(`${ROUTES.AUTH}?`)) {
    return undefined;
  }

  return path;
}

/**
 * Builds a URL pointing at the auth entry page, optionally embedding a validated
 * `redirect` target and a machine-readable `reason` code.
 */
export function buildAuthRoute(options?: { redirect?: string | null; reason?: string | null }): string {
  const searchParams = new URLSearchParams();
  const redirectPath = getSafeRedirectPath(options?.redirect);

  if (redirectPath) {
    searchParams.set(AUTH_REDIRECT_PARAM, redirectPath);
  }

  if (options?.reason) {
    searchParams.set(AUTH_REASON_PARAM, options.reason);
  }

  const search = searchParams.toString();
  return search ? `${ROUTES.AUTH}?${search}` : ROUTES.AUTH;
}

const PUBLIC_ROUTE_PREFIXES = [
  ROUTES.AUTH, // Authentication pages
  ROUTES.ABOUT, // About page
  `${ROUTES.SHARED_MEMO}/`, // Shared memo pages (share-link viewer)
  "/memos/", // Individual memo detail pages (dynamic)
] as const;

/**
 * Reports whether a given pathname corresponds to a page that unauthenticated
 * visitors are allowed to view without being bounced to the auth page.
 */
export function isPublicRoute(path: string): boolean {
  if (path === ROUTES.HOME || path === ROUTES.PUBLIC) {
    return true;
  }
  return PUBLIC_ROUTE_PREFIXES.some((route) => path.startsWith(route));
}

/**
 * Reports whether an anonymous visitor may read this path without signing in.
 * The public feed, a single memo page, and share links stay open. A non-public
 * memo still fails its own read and does not render.
 */
export function isAnonymousReadablePath(pathname: string): boolean {
  if (pathname === ROUTES.HOME || pathname === ROUTES.PUBLIC) {
    return true;
  }
  if (pathname.startsWith(`${ROUTES.SHARED_MEMO}/`)) {
    return true;
  }
  return pathname.startsWith("/memos/");
}

/**
 * Reports whether an anonymous visitor to a private instance should be redirected
 * to the sign-in page for the given path.
 *
 * Anonymous visitors can read the public feed and public memo pages. Share links
 * stay open. Everything else still goes to sign-in. Authenticated visitors and
 * open instances are never gated.
 */
export function shouldGatePrivateInstance(params: { isPrivateInstance: boolean; isAuthenticated: boolean; pathname: string }): boolean {
  const { isPrivateInstance, isAuthenticated, pathname } = params;
  if (!isPrivateInstance || isAuthenticated) {
    return false;
  }
  return !isAnonymousReadablePath(pathname);
}

/**
 * Appends the given search params to a path, so links between auth pages
 * (sign-in <-> sign-up) preserve the redirect target and other params.
 */
export function appendSearchParams(path: string, searchParams: URLSearchParams): string {
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}
