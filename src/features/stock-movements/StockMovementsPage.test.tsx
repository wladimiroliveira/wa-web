import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StockMovementsPage } from "@/features/stock-movements/StockMovementsPage";
import type { Permission } from "@/lib/api";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aProduct, aStockMovement } from "@/tests/samples";

const FLOUR = aProduct({ sku: "018f0000-0000-7000-8000-000000000020", description: "Farinha de trigo" });

function signedIn(permissions: Permission[] = ["ENTRIES_READ", "CATALOG_READ"]) {
  setRefreshToken("refresh-one");
  server.use(
    http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions }))),
    http.get(apiUrl("/products"), () => HttpResponse.json([FLOUR])),
  );
}

describe("StockMovementsPage", () => {
  it("lists each movement with its date, product, kind, signed quantity, cost and author", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/stock-movements"), () =>
        HttpResponse.json({
          items: [
            aStockMovement({
              id: "movement-2",
              type: "PRODUCTION_CONSUMPTION",
              quantity: "2.5",
              unitCost: "4.25",
              createdAt: "2026-10-02T12:00:00.000Z",
              createdBy: { id: "user-1", name: "Ana" },
            }),
            aStockMovement({ id: "movement-1", type: "ENTRY", quantity: "10", createdAt: "2026-10-01T12:00:00.000Z" }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    const [, consumption, entry] = await screen.findAllByRole("row");

    expect(within(consumption!).getByText(/^02\/10\/2026/)).toBeInTheDocument();
    expect(within(consumption!).getByText("Farinha de trigo")).toBeInTheDocument();
    expect(within(consumption!).getByText("Saída")).toBeInTheDocument();
    expect(within(consumption!).getByText("Consumo na produção")).toBeInTheDocument();
    expect(within(consumption!).getByText("−2,5 kg")).toBeInTheDocument();
    expect(within(consumption!).getByText("R$ 4,25")).toBeInTheDocument();
    expect(within(consumption!).getByText("Ana")).toBeInTheDocument();

    expect(within(entry!).getByText("Entrada")).toBeInTheDocument();
    expect(within(entry!).getByText("Lançamento de entrada")).toBeInTheDocument();
    expect(within(entry!).getByText("+10 kg")).toBeInTheDocument();
  });

  it("says nothing has moved instead of showing a bare table", async () => {
    signedIn();
    server.use(http.get(apiUrl("/stock-movements"), () => HttpResponse.json({ items: [], nextCursor: null })));

    renderWithProviders(<StockMovementsPage />);

    expect(await screen.findByText("Nenhuma movimentação encontrada.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    signedIn();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/stock-movements"), () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 502 })
          : HttpResponse.json({ items: [aStockMovement()], nextCursor: null });
      }),
    );

    renderWithProviders(<StockMovementsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Lançamento de entrada")).toBeInTheDocument();
  });

  it("shows only the movements of the product chosen in the filter", async () => {
    signedIn();
    const asked: (string | null)[] = [];
    server.use(
      http.get(apiUrl("/stock-movements"), ({ request: incoming }) => {
        asked.push(new URL(incoming.url).searchParams.get("productSku"));
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );

    renderWithProviders(<StockMovementsPage />);

    await userEvent.selectOptions(await screen.findByLabelText("Produto"), "Farinha de trigo");

    await waitFor(() => expect(asked).toEqual([null, FLOUR.sku]));
  });

  it("leaves the product filter out for whoever may not read the catalog", async () => {
    signedIn(["ENTRIES_READ"]);
    server.use(
      http.get(apiUrl("/stock-movements"), () => HttpResponse.json({ items: [aStockMovement()], nextCursor: null })),
    );

    renderWithProviders(<StockMovementsPage />);

    await screen.findByText("Lançamento de entrada");
    expect(screen.queryByLabelText("Produto")).not.toBeInTheDocument();
  });

  it("loads the older movements on request, until there are no more", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/stock-movements"), ({ request: incoming }) =>
        new URL(incoming.url).searchParams.get("cursor") === "movement-2"
          ? HttpResponse.json({
              items: [aStockMovement({ id: "movement-1", type: "PRODUCTION_OUTPUT" })],
              nextCursor: null,
            })
          : HttpResponse.json({ items: [aStockMovement({ id: "movement-2" })], nextCursor: "movement-2" }),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Produção")).toBeInTheDocument();
    expect(screen.getByText("Lançamento de entrada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });
});

describe("movement lots", () => {
  it("tells the expiry of the lot each movement moved, and a dash where it moved none", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
      http.get(apiUrl("/stock-movements"), () =>
        HttpResponse.json({
          items: [
            aStockMovement({ id: "movement-3", lot: { id: "lot-1", expiresAt: "2099-12-31", supplier: null } }),
            aStockMovement({ id: "movement-2", lot: { id: "lot-2", expiresAt: null, supplier: null } }),
            aStockMovement({ id: "movement-1", lot: null }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    const [, dated, undated, none] = await screen.findAllByRole("row");

    expect(screen.getByRole("columnheader", { name: "Validade do lote" })).toBeInTheDocument();
    expect(within(dated!).getByText("31/12/2099")).toBeInTheDocument();
    expect(within(undated!).getByText("Sem validade")).toBeInTheDocument();
    expect(within(none!).getByText("—")).toBeInTheDocument();
  });
});

describe("movement kinds", () => {
  it("names the adjustment of a negative balance as something that came in", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
      http.get(apiUrl("/stock-movements"), () =>
        HttpResponse.json({
          items: [aStockMovement({ type: "BALANCE_ADJUSTMENT", quantity: "3.5" })],
          nextCursor: null,
        }),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    expect(await screen.findByText("Ajuste de saldo")).toBeInTheDocument();
    expect(screen.getByText("Entrada")).toBeInTheDocument();
    expect(screen.getByText("+3,5 kg")).toBeInTheDocument();
  });

  it("names a loss as something that left the stock", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
      http.get(apiUrl("/stock-movements"), () =>
        HttpResponse.json({ items: [aStockMovement({ type: "LOSS", quantity: "2.5" })], nextCursor: null }),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    expect(await screen.findByText("Avaria")).toBeInTheDocument();
    expect(screen.getByText("Saída")).toBeInTheDocument();
    expect(screen.getByText("−2,5 kg")).toBeInTheDocument();
  });

  it("tells whether each movement came into the stock or left it, apart from where it came from", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ENTRIES_READ"] }))),
      http.get(apiUrl("/stock-movements"), () =>
        HttpResponse.json({
          items: [
            aStockMovement({ id: "movement-2", type: "PRODUCTION_OUTPUT" }),
            aStockMovement({ id: "movement-1", type: "PRODUCTION_CONSUMPTION" }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    const [header, output, consumption] = await screen.findAllByRole("row");

    expect(within(header!).getByRole("columnheader", { name: "Tipo" })).toBeInTheDocument();
    expect(within(header!).getByRole("columnheader", { name: "Origem" })).toBeInTheDocument();
    expect(within(output!).getByText("Entrada")).toBeInTheDocument();
    expect(within(output!).getByText("Produção")).toBeInTheDocument();
    expect(within(consumption!).getByText("Saída")).toBeInTheDocument();
  });
});

describe("StockMovementsPage layout", () => {
  it("gives the table the height left on the screen", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/stock-movements"), () => HttpResponse.json({ items: [aStockMovement()], nextCursor: null })),
    );

    renderWithProviders(<StockMovementsPage />);

    await screen.findByRole("table");
    expect(screen.getByRole("table").parentElement).toHaveAttribute("data-fill", "true");
  });
});
