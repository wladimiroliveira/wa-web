import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { StockLedgerPage } from "@/features/stock/StockLedgerPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const SUPPLY_ID = "33333333-3333-4333-8333-333333333333";

const supply = {
  id: SUPPLY_ID,
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

const entry = {
  id: "44444444-4444-4444-8444-444444444444",
  supplyId: SUPPLY_ID,
  type: "ENTRY",
  quantityBase: 5000,
  reason: null,
  note: "Nota 123",
  productionId: null,
  createdAt: "2026-08-16T12:00:00.000Z",
};

const consumption = {
  ...entry,
  id: "66666666-6666-4666-8666-666666666666",
  type: "PRODUCTION",
  quantityBase: -1200,
  note: null,
  createdAt: "2026-08-15T12:00:00.000Z",
};

/**
 * `supplyMissing` is a parameter rather than a `server.use` override in the
 * test body: `server.use` prepends, so a handler registered before this helper
 * runs would be shadowed by the one this helper registers for the same route.
 */
function renderLedger(supplyMissing = false) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["STOCK_READ"],
      }),
    ),
    msw.get(`${API}/supplies/${SUPPLY_ID}`, () =>
      supplyMissing
        ? HttpResponse.json({ message: "Insumo não encontrado" }, { status: 404 })
        : HttpResponse.json(supply),
    ),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/stock/:id" element={<StockLedgerPage />} />
      <Route path="/stock" element={<p>lista de saldos</p>} />
    </Routes>,
    { route: `/stock/${SUPPLY_ID}` },
  );
}

beforeEach(() => {
  clearSession();
});

describe("StockLedgerPage", () => {
  test("shows the type in Portuguese and the quantity signed, in the purchase unit", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () =>
        HttpResponse.json({ data: [entry, consumption], nextCursor: null }),
      ),
    );
    renderLedger();

    const entryRow = (await screen.findByText("Entrada")).closest("tr")!;
    const consumptionRow = screen.getByText("Produção").closest("tr")!;

    expect(entryRow).toHaveTextContent("+5 kg");
    expect(entryRow).toHaveTextContent("16/08/2026");
    expect(consumptionRow).toHaveTextContent("-1,2 kg");
  });

  test("shows the supply's name and current balance in the header", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () => HttpResponse.json({ data: [entry], nextCursor: null })),
    );
    renderLedger();

    expect(await screen.findByRole("heading", { name: /farinha de trigo/i })).toBeInTheDocument();
    expect(screen.getByText(/12,5 kg/)).toBeInTheDocument();
  });

  test("loads the next page with the cursor it was given", async () => {
    const cursors: (string | null)[] = [];
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return cursor
          ? HttpResponse.json({ data: [consumption], nextCursor: null })
          : HttpResponse.json({ data: [entry], nextCursor: entry.id });
      }),
    );
    renderLedger();

    await userEvent.click(await screen.findByRole("button", { name: /carregar mais/i }));

    expect(await screen.findByText("Produção")).toBeInTheDocument();
    expect(cursors).toEqual([null, entry.id]);
  });

  test("hides the button when the API says there is no next page", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () => HttpResponse.json({ data: [entry], nextCursor: null })),
    );
    renderLedger();

    expect(await screen.findByText("Entrada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /carregar mais/i })).not.toBeInTheDocument();
  });

  test("says so when the supply has never moved", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );
    renderLedger();

    expect(await screen.findByText(/nenhuma movimentação registrada/i)).toBeInTheDocument();
  });

  // A stale URL is not an exceptional case, so it lands in the inline error
  // state with a way back, not in a route error boundary.
  test("a 404 offers the name of the problem and a way back", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () =>
        HttpResponse.json({ message: "Insumo não encontrado" }, { status: 404 }),
      ),
    );
    renderLedger(true);

    expect(await screen.findByText(/insumo não encontrado/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para estoque/i })).toBeInTheDocument();
  });
});
