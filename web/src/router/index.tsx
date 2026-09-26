import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import App from "@/App";
import { ChunkLoadErrorFallback } from "@/components/ErrorBoundary";
import MainLayout from "@/layouts/MainLayout";
import RootLayout from "@/layouts/RootLayout";
import { lazyWithReload } from "@/utils/lazy";
import {
  LandingRoute,
  RequireAuthRoute,
  RequireFullInitializationRoute,
  RequireGuestRoute,
  RequireInstanceInitializationRoute,
} from "./guards";
import { ROUTES, SPACE_ROUTE_PATTERN } from "./routes";
import { SpaceRoute } from "./SpaceRoute";

const AdminSignIn = lazyWithReload(() => import("@/pages/AdminSignIn"));
const About = lazyWithReload(() => import("@/pages/About"));
const Archived = lazyWithReload(() => import("@/pages/Archived"));
const Home = lazyWithReload(() => import("@/pages/Home"));
const MemoDetail = lazyWithReload(() => import("@/pages/MemoDetail"));
const NotFound = lazyWithReload(() => import("@/pages/NotFound"));
const PermissionDenied = lazyWithReload(() => import("@/pages/PermissionDenied"));
const Attachments = lazyWithReload(() => import("@/pages/Attachments"));
const Setting = lazyWithReload(() => import("@/pages/Setting"));
const SignIn = lazyWithReload(() => import("@/pages/SignIn"));
const SignUp = lazyWithReload(() => import("@/pages/SignUp"));

// Backward compatibility alias.
export const Routes = ROUTES;
export { ROUTES };

/**
 * Static route configuration. Exported so tests can assert on the tree shape
 * and so integration tests can drive a `createMemoryRouter` over the same tree.
 */
export const routeConfig: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    errorElement: <ChunkLoadErrorFallback />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          {
            element: <RequireInstanceInitializationRoute />,
            children: [
              {
                element: <RequireGuestRoute />,
                children: [
                  { path: "", element: <SignIn /> },
                  { path: "admin", element: <AdminSignIn /> },
                  { path: "signup", element: <SignUp /> },
                ],
              },
            ],
          },
        ],
      },
      // Backward compatibility: the old `/home` URL now lives at `/`.
      { path: "home", element: <Navigate to={Routes.HOME} replace /> },
      {
        element: <RootLayout />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                element: <LandingRoute />,
                children: [{ index: true, element: <Home /> }],
              },
              {
                element: <RequireInstanceInitializationRoute />,
                children: [{ path: Routes.ABOUT, element: <About /> }],
              },
              {
                element: <RequireAuthRoute />,
                children: [{ path: Routes.ARCHIVED, element: <Archived /> }],
              },
            ],
          },
          { path: "memos/:uid", element: <MemoDetail /> },
          { path: "memos/shares/:token", element: <MemoDetail /> },
          {
            element: <RequireAuthRoute />,
            children: [
              {
                element: <RequireFullInitializationRoute />,
                children: [
                  {
                    path: SPACE_ROUTE_PATTERN,
                    children: [
                      {
                        element: <SpaceRoute />,
                        children: [
                          {
                            element: <MainLayout />,
                            children: [{ index: true, element: <Home /> }],
                          },
                          { path: "attachments", element: <Attachments /> },
                        ],
                      },
                      { path: "*", element: <NotFound /> },
                    ],
                  },
                  { path: Routes.ATTACHMENTS, element: <Attachments /> },
                  { path: Routes.SETTING, element: <Setting /> },
                ],
              },
            ],
          },
          { path: "403", element: <PermissionDenied /> },
          { path: "404", element: <NotFound /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routeConfig);

export default router;
