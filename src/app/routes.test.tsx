import { HttpResponse, delay, http } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setRefreshToken } from "@/lib/tokens";
import { AppTree, routes } from "@/tests/app-tree";
import { apiUrl, server } from "@/tests/msw-server";
import { navigation } from "@/tests/navigation";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aPreWeighing, aProductStock, aSessionTokens } from "@/tests/samples";

// The application as the file tree under `src/app` assembles it, opened at one address.
const renderApp = (route: string) => renderWithProviders(<AppTree />, { route });

describe("routes", () => {
  // Every screen and the guards above it, in one readable list. Loosening a permission stops being
  // a layout file buried in a group and starts being a line in the diff of this snapshot.
  it("declares the guards of every screen", () => {
    const inventory = routes.map((route) => `${route.pattern} -> ${route.guards.join(" > ") || "(none)"}`);

    expect(inventory.join("\n")).toMatchSnapshot();
  });

  it("answers an unknown address with the not-found screen", async () => {
    renderApp("/nowhere");

    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  });

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

    renderApp("/roles");

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Papéis" })).toBeInTheDocument();
    expect(navigation.url).toBe("/roles");
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

    renderApp("/entries");

    expect(await screen.findByRole("heading", { name: "Entradas" })).toBeInTheDocument();
  });

  // The screen cannot offer a product without reading the catalog, so the route asks for
  // both permissions rather than opening onto a form that can never be filled.
  it("refuses the entries screen to whoever may not read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_CREATE"] }))),
    );

    renderApp("/entries");

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument();
  });

  it("opens the catalog for whoever may read it", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
      http.get(apiUrl("/products"), () => HttpResponse.json([])),
    );

    renderApp("/products");

    expect(await screen.findByRole("heading", { name: "Produtos" })).toBeInTheDocument();
  });

  it("opens the movement history for whoever may read the entries", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
      http.get(apiUrl("/stock-movements"), () => HttpResponse.json({ items: [], nextCursor: null })),
    );

    renderApp("/stock-movements");

    expect(await screen.findByRole("heading", { name: "Movimentações" })).toBeInTheDocument();
  });

  it("opens the stock analysis for whoever may read the reports", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["REPORTS_READ"] }))),
      http.get(apiUrl("/stock"), () => HttpResponse.json({ items: [], totalValue: "0.00" })),
    );

    renderApp("/stock");

    expect(await screen.findByRole("heading", { name: "Análise de estoque" })).toBeInTheDocument();
  });

  it("opens the suppliers for whoever may read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
      http.get(apiUrl("/suppliers"), () => HttpResponse.json([])),
    );

    renderApp("/suppliers");

    expect(await screen.findByRole("heading", { name: "Fornecedores" })).toBeInTheDocument();
  });

  it("opens the lots of a product for whoever may read the reports", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["REPORTS_READ"] }))),
      http.get(apiUrl("/stock/sku-1"), () => HttpResponse.json(aProductStock())),
    );

    renderApp("/stock/sku-1");

    expect(await screen.findByRole("heading", { name: "Farinha de trigo" })).toBeInTheDocument();
  });

  it("opens the loss reasons for whoever may manage them", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["LOSSES_UPDATE"] }))),
      http.get(apiUrl("/loss-reasons"), () => HttpResponse.json([])),
    );

    renderApp("/loss-reasons");

    expect(await screen.findByRole("heading", { name: "Modalidades de avaria" })).toBeInTheDocument();
  });

  it("opens the pre-weighings for whoever may read the production", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["PRODUCTION_READ"] }))),
      http.get(apiUrl("/pre-weighings"), () => HttpResponse.json({ items: [], nextCursor: null })),
    );

    renderApp("/pre-weighings");

    expect(await screen.findByRole("heading", { name: "Pré-pesagens" })).toBeInTheDocument();
  });

  it("opens one pre-weighing for whoever may read the production", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["PRODUCTION_READ"] }))),
      http.get(apiUrl("/pre-weighings/pre-weighing-1"), () => HttpResponse.json(aPreWeighing())),
    );

    renderApp("/pre-weighings/pre-weighing-1");

    expect(await screen.findByRole("heading", { name: "Pré-pesagem de Pão francês" })).toBeInTheDocument();
  });

  it("opens the new pre-weighing for whoever may record the production and read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () =>
        HttpResponse.json(aCurrentUser({ permissions: ["PRODUCTION_READ", "PRODUCTION_CREATE", "CATALOG_READ"] })),
      ),
      http.get(apiUrl("/products"), () => HttpResponse.json([])),
    );

    renderApp("/pre-weighings/new");

    expect(await screen.findByRole("heading", { name: "Nova pré-pesagem" })).toBeInTheDocument();
  });

  // The plan is read with one permission and recorded with another, and the product comes from the
  // catalog: the route asks for all three rather than opening onto a form that can never be filled.
  it.each([
    ["record the production", ["PRODUCTION_READ", "CATALOG_READ"]],
    ["read the catalog", ["PRODUCTION_READ", "PRODUCTION_CREATE"]],
  ] as const)("refuses the new pre-weighing to whoever may not %s", async (_, permissions) => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: [...permissions] }))),
    );

    renderApp("/pre-weighings/new");

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument();
  });

  it("opens the recipes for whoever may edit and read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () =>
        HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_UPDATE", "CATALOG_READ"] })),
      ),
      http.get(apiUrl("/products"), () => HttpResponse.json([])),
      http.get(apiUrl("/recipes"), () => HttpResponse.json([])),
    );

    renderApp("/recipes");

    expect(await screen.findByRole("heading", { name: "Receitas" })).toBeInTheDocument();
  });

  // A recipe is saved with one permission and its products come from the catalog, read with another.
  it.each([
    ["edit the catalog", ["CATALOG_READ"]],
    ["read the catalog", ["CATALOG_UPDATE"]],
  ] as const)("refuses the recipes to whoever may not %s", async (_, permissions) => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: [...permissions] }))),
    );

    renderApp("/recipes");

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument();
  });
});
