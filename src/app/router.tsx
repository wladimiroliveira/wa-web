import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";
import { UnderConstructionPage } from "@/features/placeholder/UnderConstructionPage";
import { RoleFormPage } from "@/features/roles/RoleFormPage";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { SuppliesListPage } from "@/features/supplies/SuppliesListPage";
import { SupplyFormPage } from "@/features/supplies/SupplyFormPage";
import { UserFormPage } from "@/features/users/UserFormPage";
import { UsersListPage } from "@/features/users/UsersListPage";

/** Menu destinations that already have a real screen. */
const BUILT_ROUTES = new Set(["/supplies", "/users", "/roles"]);

const placeholderItems = NAV_ITEMS.filter((item) => !BUILT_ROUTES.has(item.to));

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      { path: "/", element: <HomePage /> },
      ...placeholderItems.map((item) => ({
        element: <RequirePermission permission={item.permission} />,
        children: [{ path: item.to, element: <UnderConstructionPage title={item.label} /> }],
      })),
      {
        element: <RequirePermission permission="USERS_READ" />,
        errorElement: <RouteError />,
        children: [
          { path: "/users", element: <UsersListPage /> },
          { path: "/roles", element: <RolesListPage /> },
        ],
      },
      {
        element: <RequirePermission permission="SUPPLIES_READ" />,
        errorElement: <RouteError />,
        children: [{ path: "/supplies", element: <SuppliesListPage /> }],
      },
      {
        element: <RequirePermission permission="USERS_WRITE" />,
        errorElement: <RouteError />,
        children: [
          // Static before dynamic: `/users/new` must not be read as an id.
          { path: "/users/new", element: <UserFormPage /> },
          { path: "/users/:id", element: <UserFormPage /> },
          { path: "/roles/new", element: <RoleFormPage /> },
          { path: "/roles/:id", element: <RoleFormPage /> },
        ],
      },
      {
        element: <RequirePermission permission="SUPPLIES_WRITE" />,
        errorElement: <RouteError />,
        children: [
          // Static before dynamic: `/supplies/new` must not be read as an id.
          { path: "/supplies/new", element: <SupplyFormPage /> },
          { path: "/supplies/:id", element: <SupplyFormPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
