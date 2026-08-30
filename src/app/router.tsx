import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";
import { RolesListPage } from "@/features/roles/RolesListPage";

export const routes: RouteObject[] = [
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
];

export const router = createBrowserRouter(routes);
