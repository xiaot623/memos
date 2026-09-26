import { matchPath } from "react-router-dom";
import { extractSpaceUidFromName } from "@/lib/space-display";

export const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  ATTACHMENTS: "/attachments",
  ARCHIVED: "/archived",
  SETTING: "/setting",
  AUTH: "/auth",
  AUTH_SIGNUP: "/auth/signup",
  AUTH_ADMIN: "/auth/admin",
  SHARED_MEMO: "/memos/shares",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export const SPACE_ROUTE_PATTERN = "/spaces/:spaceUid";

/** Collection pages that exist both globally and beneath a Space. */
const COLLECTION_ROUTE_PATTERNS = [ROUTES.HOME, ROUTES.ATTACHMENTS];

const isCollectionPathname = (pathname: string): boolean =>
  COLLECTION_ROUTE_PATTERNS.some((path) => matchPath({ path, caseSensitive: false }, pathname) !== null);

export interface CollectionRoute {
  spaceName?: string;
  /** The global twin of a collection page; otherwise the normalized pathname. */
  pathname: string;
  isCollection: boolean;
}

/** The URL owns collection scope; unknown Space subroutes are not collection pages. */
export const resolveCollectionRoute = (path: string): CollectionRoute => {
  const pathname = (path.split(/[?#]/, 1)[0] || ROUTES.HOME).replace(/\/+$/, "") || ROUTES.HOME;
  const spaceMatch = matchPath({ path: `${SPACE_ROUTE_PATTERN}/*`, caseSensitive: false }, pathname);
  if (!spaceMatch) return { pathname, isCollection: isCollectionPathname(pathname) };
  const uid = spaceMatch.params.spaceUid ?? "";
  const collectionPath = `/${spaceMatch.params["*"] ?? ""}`;
  // An encoded slash decodes into a UID that cannot round-trip through buildCollectionPath.
  if (!uid || uid.includes("/") || !isCollectionPathname(collectionPath)) return { pathname, isCollection: false };
  return { spaceName: `spaces/${uid}`, pathname: collectionPath, isCollection: true };
};

/** Builds a collection URL from a global collection pathname and an optional Space. */
export const buildCollectionPath = (pathname: string, spaceName?: string): string => {
  const route = resolveCollectionRoute(pathname);
  if (!route.isCollection) return pathname;
  if (!spaceName) return route.pathname;
  const base = `/spaces/${encodeURIComponent(extractSpaceUidFromName(spaceName))}`;
  return route.pathname === ROUTES.HOME ? base : `${base}${route.pathname}`;
};

/** Carries the current Space into another collection view. */
export const collectionPathForLocation = (pathname: string, currentPath: string): string =>
  buildCollectionPath(pathname, resolveCollectionRoute(currentPath).spaceName);

/** Switching preserves collection views and their query; other pages start at Home. */
export const getSpaceSwitchPath = (location: { pathname: string; search: string; hash?: string }, spaceName?: string): string => {
  const route = resolveCollectionRoute(location.pathname);
  return route.isCollection
    ? `${buildCollectionPath(route.pathname, spaceName)}${location.search}${location.hash || ""}`
    : buildCollectionPath(ROUTES.HOME, spaceName);
};
