import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StockProductPage } from "@/features/stock/StockProductPage";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { arrangedTable, columnHeaders } from "@/tests/table-layouts";
import { chooseRowAction } from "@/tests/row-actions";
import type { Permission } from "@/lib/api";
import { setRefreshToken } from "@/lib/tokens";
import { aCurrentUser, aProductStock, aStockLot } from "@/tests/samples";

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/stock/:sku" element={<StockProductPage />} />
    </Routes>,
    { route: "/stock/sku-1" },
  );
}

const rows = async () => (await screen.findAllByRole("row")).slice(1).map((row) => within(row));

describe("StockProductPage", () => {
  it("names the product and sums up its position", async () => {
    server.use(
      http.get(apiUrl("/stock/sku-1"), () =>
        HttpResponse.json(
          aProductStock({ quantity: "1250.5", value: "5314.63", nextExpiresAt: "2026-12-31", status: "EXPIRING_SOON" }),
        ),
      ),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Farinha de trigo" })).toBeInTheDocument();

    const summary = within(screen.getByRole("group", { name: "Resumo do produto" }));
    expect(summary.getByText("1.250,5 kg")).toBeInTheDocument();
    expect(summary.getByText("R$ 5.314,63")).toBeInTheDocument();
    expect(summary.getByText("31/12/2026")).toBeInTheDocument();
    expect(summary.getByText("Vence em breve")).toBeInTheDocument();
  });

  it("lists each lot with its expiry, supplier, entry date, quantities, cost, value and situation", async () => {
    server.use(
      http.get(apiUrl("/stock/sku-1"), () =>
        HttpResponse.json(
          aProductStock({
            lots: [
              aStockLot({
                id: "lot-1",
                expiresAt: "2026-10-20",
                supplier: { id: "supplier-1", name: "Moinho Santa Clara" },
                initialQuantity: "8",
                quantity: "3",
                unitCost: "6",
                value: "18.00",
                createdAt: "2026-10-02T12:00:00.000Z",
                status: "EXPIRING_SOON",
              }),
              aStockLot({ id: "lot-2", status: "EXPIRED", expiresAt: "2026-10-01" }),
              aStockLot({ id: "lot-3" }),
            ],
          }),
        ),
      ),
    );

    renderPage();

    const [soon, expired, never] = await rows();

    expect(soon!.getByText("20/10/2026")).toBeInTheDocument();
    expect(soon!.getByText("Moinho Santa Clara")).toBeInTheDocument();
    expect(soon!.getByText(/^02\/10\/2026/)).toBeInTheDocument();
    expect(soon!.getByText("8 kg")).toBeInTheDocument();
    expect(soon!.getByText("3 kg")).toBeInTheDocument();
    expect(soon!.getByText("R$ 6,00")).toBeInTheDocument();
    expect(soon!.getByText("R$ 18,00")).toBeInTheDocument();
    expect(soon!.getByText("Vence em breve")).toBeInTheDocument();

    expect(expired!.getByText("Vencido")).toBeInTheDocument();

    expect(never!.getByText("Sem validade")).toBeInTheDocument();
    expect(never!.getByText("—")).toBeInTheDocument();
    expect(never!.getByText("OK")).toBeInTheDocument();
  });

  it("says the product holds no lots instead of showing a bare table", async () => {
    server.use(
      http.get(apiUrl("/stock/sku-1"), () =>
        HttpResponse.json(aProductStock({ lots: [], quantity: "0", lotCount: 0, status: "EMPTY" })),
      ),
    );

    renderPage();

    expect(await screen.findByText("Nenhum lote com saldo.")).toBeInTheDocument();
  });

  it("brings the depleted lots in when asked, and names them as such", async () => {
    const asked: (string | null)[] = [];
    server.use(
      http.get(apiUrl("/stock/sku-1"), ({ request: incoming }) => {
        const depleted = new URL(incoming.url).searchParams.get("depleted");
        asked.push(depleted);

        return HttpResponse.json(
          aProductStock({
            lots: depleted === "true" ? [aStockLot({ id: "lot-9", quantity: "0", status: "DEPLETED" })] : [],
          }),
        );
      }),
    );

    renderPage();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Mostrar lotes esgotados" }));

    expect(await screen.findByText("Esgotado")).toBeInTheDocument();
    await waitFor(() => expect(asked).toEqual([null, "true"]));
  });

  it("leads back to the analysis of the whole stock", async () => {
    server.use(http.get(apiUrl("/stock/sku-1"), () => HttpResponse.json(aProductStock())));

    renderPage();

    expect(await screen.findByRole("link", { name: "Voltar para a análise de estoque" })).toHaveAttribute(
      "href",
      "/stock",
    );
  });

  it("says the product does not exist rather than failing in general terms", async () => {
    server.use(
      http.get(apiUrl("/stock/sku-1"), () => HttpResponse.json({ message: "Product not found." }, { status: 404 })),
    );

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Esse produto não existe mais.");
  });

  it("offers a way out when the lots fail to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/stock/sku-1"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json(aProductStock());
      }),
    );

    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("heading", { name: "Farinha de trigo" })).toBeInTheDocument();
  });

  describe("writing a lot off", () => {
    const signedIn = (permissions: Permission[]) => {
      setRefreshToken("refresh-one");
      server.use(
        http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions }))),
        http.get(apiUrl("/loss-reasons"), () => HttpResponse.json([])),
        http.get(apiUrl("/stock/sku-1"), () =>
          HttpResponse.json(
            aProductStock({
              lots: [
                aStockLot({ id: "lot-1", quantity: "3" }),
                aStockLot({ id: "lot-2", quantity: "0", status: "DEPLETED" }),
              ],
            }),
          ),
        ),
      );
    };

    it("offers it on each lot that still holds something, to whoever may record a loss", async () => {
      signedIn(["REPORTS_READ", "LOSSES_CREATE"]);

      renderPage();

      const [held, depleted] = await rows();

      await chooseRowAction("Ações do lote", "Registrar avaria", held);

      expect(await screen.findByRole("dialog")).toHaveTextContent("saldo de 3 kg");
      expect(depleted!.queryByRole("button", { name: "Ações do lote" })).not.toBeInTheDocument();
    });

    it("hides it from whoever may only read the reports", async () => {
      signedIn(["REPORTS_READ"]);

      renderPage();

      const [held] = await rows();

      expect(held!.getByText("3 kg")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ações do lote" })).not.toBeInTheDocument();
    });
  });
});

describe("StockProductPage columns", () => {
  it("shows the columns in the order the user arranged them", async () => {
    arrangedTable("stock-lots", { order: ["supplier", "expiry"] });
    server.use(http.get(apiUrl("/stock/sku-1"), () => HttpResponse.json(aProductStock())));

    renderPage();

    await waitFor(() => expect(columnHeaders()[0]).toBe("Fornecedor"));
  });
});
