import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RequireSession } from "@/features/auth/RequireSession";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { HomePage } from "@/features/home/HomePage";
import { RolesListPage } from "@/features/roles/RolesListPage";

export const routes: RouteObject[] = [
  {
    // Without this, an unknown URL or a render failure on `LoginPage` — which
    // sits outside every other guard — falls through to React Router's own
    // built-in boundary, which writes "Unexpected Application Error!" in English.
    errorElement: <RouteError />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AppShell />,
            errorElement: <RouteError />,
            children: [
              { path: "/", element: <HomePage /> },
              { path: "/change-password", element: <ChangePasswordPage /> },
              {
                element: <RequirePermission permission="ACCESS_READ" />,
                children: [{ path: "/roles", element: <RolesListPage /> }],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
