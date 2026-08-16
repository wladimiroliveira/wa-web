import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { StockListPage } from "@/features/stock/StockListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const flour = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

const box = {
  ...flour,
  id: "55555555-5555-4555-8555-555555555555",
  name: "Caixa de bolo",
  type: "PACKAGING",
  purchaseUnit: "UN",
  currentStock: -3,
};

function renderList(permissions: string[], supplies: unknown[] = [flour, box]) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions,
      }),
    ),
    msw.get(`${API}/supplies`, () => HttpResponse.json(supplies)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/stock" element={<StockListPage />} />
    </Routes>,
    { route: "/stock" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("StockListPage", () => {
  test("shows the balance in the unit the supply is bought in, not the base", async () => {
    renderList(["STOCK_READ", "STOCK_WRITE"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;

    expect(row).toHaveTextContent("12,5 kg");
    expect(row).not.toHaveTextContent("12500");
  });

  // A production may consume more than there is: the API records it and warns
  // instead of refusing, so this is a state the screen must show, not an edge case.
  test("marks a negative balance", async () => {
    renderList(["STOCK_READ"]);

    const row = (await screen.findByText("Caixa de bolo")).closest("tr")!;
    const balance = row.querySelector("[data-negative]")!;

    expect(balance).toHaveAttribute("data-negative", "true");
    expect(balance).toHaveTextContent("-3 un");
  });

  test("a positive balance is not marked", async () => {
    renderList(["STOCK_READ"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;

    expect(row.querySelector("[data-negative]")).toHaveAttribute("data-negative", "false");
  });

  test("each supply links to its own ledger", async () => {
    renderList(["STOCK_READ"]);

    expect(await screen.findByRole("link", { name: "Farinha de trigo" })).toHaveAttribute("href", `/stock/${flour.id}`);
  });

  // The entry lives in a dialog inside a read route, so there is no route gate
  // to raise here. The button hiding is convenience; the API is the real gate.
  test("hides the entry button from someone who cannot write stock", async () => {
    renderList(["STOCK_READ"]);

    expect(await screen.findByText("Farinha de trigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrada/i })).not.toBeInTheDocument();
  });

  test("shows the entry button to someone who can", async () => {
    renderList(["STOCK_READ", "STOCK_WRITE"]);

    expect(await screen.findAllByRole("button", { name: /entrada/i })).toHaveLength(2);
  });

  test("says so when there is nothing registered", async () => {
    renderList(["STOCK_READ"], []);

    expect(await screen.findByText(/nenhum insumo cadastrado/i)).toBeInTheDocument();
  });

  test("the entry button opens the dialog for that supply", async () => {
    renderList(["STOCK_READ", "STOCK_WRITE"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: /entrada/i }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Farinha de trigo");
  });
});
