import { createBrowserRouter } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";
import { UnderConstructionPage } from "@/features/placeholder/UnderConstructionPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      { path: "/", element: <HomePage /> },
      ...NAV_ITEMS.map((item) => ({
        element: <RequirePermission permission={item.permission} />,
        children: [{ path: item.to, element: <UnderConstructionPage title={item.label} /> }],
      })),
    ],
  },
]);
