import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";

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
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
