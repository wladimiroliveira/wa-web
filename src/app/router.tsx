import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RequireSession } from "@/features/auth/RequireSession";
import { EntryPage } from "@/features/entries/EntryPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { HomePage } from "@/features/home/HomePage";
import { LossReasonsPage } from "@/features/losses/LossReasonsPage";
import { PreWeighingDetailPage } from "@/features/pre-weighings/PreWeighingDetailPage";
import { PreWeighingPage } from "@/features/pre-weighings/PreWeighingPage";
import { PreWeighingsListPage } from "@/features/pre-weighings/PreWeighingsListPage";
import { RecipesListPage } from "@/features/recipes/RecipesListPage";
import { ProductsListPage } from "@/features/products/ProductsListPage";
import { SuppliersListPage } from "@/features/suppliers/SuppliersListPage";
import { StockProductPage } from "@/features/stock/StockProductPage";
import { StockPositionPage } from "@/features/stock/StockPositionPage";
import { StockMovementsPage } from "@/features/stock-movements/StockMovementsPage";
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
                element: <RequirePermission permission="CATALOG_READ" />,
                children: [
                  { path: "/products", element: <ProductsListPage /> },
                  { path: "/suppliers", element: <SuppliersListPage /> },
                  {
                    element: <RequirePermission permission="CATALOG_UPDATE" />,
                    children: [{ path: "/recipes", element: <RecipesListPage /> }],
                  },
                ],
              },
              {
                element: <RequirePermission permission="ENTRIES_CREATE" />,
                children: [
                  {
                    // The form cannot offer a product without reading the catalog.
                    element: <RequirePermission permission="CATALOG_READ" />,
                    children: [{ path: "/entries", element: <EntryPage /> }],
                  },
                ],
              },
              {
                element: <RequirePermission permission="ENTRIES_READ" />,
                children: [{ path: "/stock-movements", element: <StockMovementsPage /> }],
              },
              {
                element: <RequirePermission permission="REPORTS_READ" />,
                children: [
                  { path: "/stock", element: <StockPositionPage /> },
                  { path: "/stock/:sku", element: <StockProductPage /> },
                ],
              },
              {
                element: <RequirePermission permission="PRODUCTION_READ" />,
                children: [
                  { path: "/pre-weighings", element: <PreWeighingsListPage /> },
                  { path: "/pre-weighings/:id", element: <PreWeighingDetailPage /> },
                  {
                    element: <RequirePermission permission="PRODUCTION_CREATE" />,
                    children: [
                      {
                        // The form cannot offer a product without reading the catalog.
                        element: <RequirePermission permission="CATALOG_READ" />,
                        children: [{ path: "/pre-weighings/new", element: <PreWeighingPage /> }],
                      },
                    ],
                  },
                ],
              },
              {
                element: <RequirePermission permission="LOSSES_UPDATE" />,
                children: [{ path: "/loss-reasons", element: <LossReasonsPage /> }],
              },
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
