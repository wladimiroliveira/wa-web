import { HttpResponse, delay, http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import { SessionProvider } from "@/features/auth/session-context";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aCurrentUser, aProductStock, aSessionTokens } from "@/tests/samples";

/**
 * Not `renderWithProviders`: that helper wraps its `ui` in its own `MemoryRouter`,
 * and nesting a second router inside a `RouterProvider` throws. This is the router
 * itself under test, so it needs `createMemoryRouter` driving `routes` directly.
 */
function renderApp(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries });

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

describe("routes", () => {
  it("sends an anonymous visitor to sign in, then back to the page they asked for", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json(aSessionTokens())),
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
      http.get(apiUrl("/roles"), async () => {
        // Delayed on purpose: the round trip is not complete until the destination
        // screen has rendered its own loading state, not just its heading.
        await delay(20);
        return HttpResponse.json([]);
      }),
    );

    renderApp(["/roles"]);

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Papéis" })).toBeInTheDocument();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();

    expect(await screen.findByText("Nenhum papel cadastrado ainda.")).toBeInTheDocument();
  });

  it("opens the entries screen for whoever may record an entry and read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () =>
        HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_CREATE", "CATALOG_READ"] })),
      ),
      http.get(apiUrl("/products"), () => HttpResponse.json([])),
    );

    renderApp(["/entries"]);

    expect(await screen.findByRole("heading", { name: "Entradas" })).toBeInTheDocument();
  });

  // The screen cannot offer a product without reading the catalog, so the route asks for
  // both permissions rather than opening onto a form that can never be filled.
  it("refuses the entries screen to whoever may not read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_CREATE"] }))),
    );

    renderApp(["/entries"]);

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument();
  });

  it("opens the catalog for whoever may read it", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
      http.get(apiUrl("/products"), () => HttpResponse.json([])),
    );

    renderApp(["/products"]);

    expect(await screen.findByRole("heading", { name: "Produtos" })).toBeInTheDocument();
  });

  it("opens the movement history for whoever may read the entries", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
      http.get(apiUrl("/stock-movements"), () => HttpResponse.json({ items: [], nextCursor: null })),
    );

    renderApp(["/stock-movements"]);

    expect(await screen.findByRole("heading", { name: "Movimentações" })).toBeInTheDocument();
  });

  it("opens the stock analysis for whoever may read the reports", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["REPORTS_READ"] }))),
      http.get(apiUrl("/stock"), () => HttpResponse.json({ items: [], totalValue: "0.00" })),
    );

    renderApp(["/stock"]);

    expect(await screen.findByRole("heading", { name: "Análise de estoque" })).toBeInTheDocument();
  });

  it("opens the suppliers for whoever may read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
      http.get(apiUrl("/suppliers"), () => HttpResponse.json([])),
    );

    renderApp(["/suppliers"]);

    expect(await screen.findByRole("heading", { name: "Fornecedores" })).toBeInTheDocument();
  });

  it("opens the lots of a product for whoever may read the reports", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["REPORTS_READ"] }))),
      http.get(apiUrl("/stock/sku-1"), () => HttpResponse.json(aProductStock())),
    );

    renderApp(["/stock/sku-1"]);

    expect(await screen.findByRole("heading", { name: "Farinha de trigo" })).toBeInTheDocument();
  });

  it("opens the loss reasons for whoever may manage them", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["LOSSES_UPDATE"] }))),
      http.get(apiUrl("/loss-reasons"), () => HttpResponse.json([])),
    );

    renderApp(["/loss-reasons"]);

    expect(await screen.findByRole("heading", { name: "Modalidades de avaria" })).toBeInTheDocument();
  });
});
