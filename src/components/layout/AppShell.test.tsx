import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { getRefreshToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

describe("AppShell", () => {
  it("shows who is signed in", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ name: "Ana" }))));

    renderWithProviders(<AppShell />);

    expect(await screen.findByText("Ana")).toBeInTheDocument();
  });

  it("hides a destination the operator may not open", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    await screen.findByText("Operador");
    expect(screen.queryByRole("link", { name: "Papéis" })).not.toBeInTheDocument();
  });

  it("offers a destination the operator may open", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Papéis" })).toHaveAttribute("href", "/roles");
  });

  it("offers the entries screen to whoever may record an entry", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_CREATE"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Entradas" })).toHaveAttribute("href", "/entries");
  });

  it("offers the recipes to whoever may edit the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_UPDATE"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Receitas" })).toHaveAttribute("href", "/recipes");
  });

  it("offers the catalog to whoever may read it", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Produtos" })).toHaveAttribute("href", "/products");
  });

  it("offers the movement history to whoever may read the entries", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Movimentações" })).toHaveAttribute("href", "/stock-movements");
  });

  it("offers the stock analysis to whoever may read the reports", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["REPORTS_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Estoque" })).toHaveAttribute("href", "/stock");
  });

  it("offers the suppliers to whoever may read the catalog", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Fornecedores" })).toHaveAttribute("href", "/suppliers");
  });

  it("offers the loss reasons to whoever may manage them", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["LOSSES_UPDATE"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Modalidades de avaria" })).toHaveAttribute("href", "/loss-reasons");
  });

  it("offers the pre-weighings to whoever may read the production", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["PRODUCTION_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Pré-pesagens" })).toHaveAttribute("href", "/pre-weighings");
  });

  it("signs the operator out on request, leaving no session behind", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())),
      http.post(apiUrl("/sessions/signout"), () => new HttpResponse(null, { status: 204 })),
    );

    renderWithProviders(<AppShell />);
    await screen.findByText("Operador");

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    // The toast is not asserted here: `Toaster` lives in `App`, above this shell,
    // so it is out of this test's tree. What matters is that the session is gone.
    await waitFor(() => expect(getRefreshToken()).toBeNull());
  });
});
