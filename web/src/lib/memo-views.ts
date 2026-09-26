import { ROUTES, resolveCollectionRoute } from "@/router/routes";

export type MemoScope = "home" | "archived";
export type PrimaryMemoScope = "home";

export const BUILTIN_TASKS_VIEW_ID = "__built_in_tasks__";
export const BUILTIN_TASKS_VIEW_FILTER = "has_task_list && has_incomplete_tasks";

const cleanPathname = (value: string): string => {
  const pathname = value.split(/[?#]/, 1)[0] || ROUTES.HOME;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
};

/** Lower-cased global pathname, so a Space-scoped URL compares like its global twin. */
const comparablePathname = (pathname: string): string => resolveCollectionRoute(pathname).pathname.toLowerCase();

export const isMemoScopeRoute = (pathname: string): boolean => {
  const comparablePath = comparablePathname(pathname);
  return comparablePath === ROUTES.HOME || comparablePath === ROUTES.ARCHIVED;
};

/** Routes that render a memo collection the sidebar can narrow. */
export const isMemoCollectionRoute = (pathname: string): boolean => isMemoScopeRoute(pathname);

export const getMemoScopePath = (_scope: PrimaryMemoScope): string => ROUTES.HOME;

interface ResolveMemoScopeOptions {
  detailFrom?: string;
  memoArchived?: boolean;
  fallback?: MemoScope;
}

export const resolveMemoScope = (pathname: string, options: ResolveMemoScopeOptions = {}): MemoScope => {
  const cleanPath = cleanPathname(pathname);
  const comparablePath = comparablePathname(cleanPath);
  if (comparablePath === ROUTES.ARCHIVED) return "archived";
  if (comparablePath === ROUTES.HOME) return "home";

  if (comparablePath.startsWith("/memos/") && options.detailFrom) {
    return resolveMemoScope(options.detailFrom, {
      fallback: options.fallback,
    });
  }

  if (comparablePath.startsWith("/memos/") && options.memoArchived) {
    return "archived";
  }

  return options.fallback ?? "home";
};
