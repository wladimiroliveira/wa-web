import { HttpResponse, http } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StockPositionPage } from "@/features/stock/StockPositionPage";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aStockItem, aStockPosition } from "@/tests/samples";

const product = (description: string) => ({
  sku: `sku-${description}`,
  description,
  unit: "KILOGRAM" as const,
});

const rowOf = (description: string) => within(screen.getByText(description).closest("tr")!);

describe("StockPositionPage", () => {
  it("shows the balance, the minimum, the costs and the value of each product", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(
          aStockPosition({
            items: [
              aStockItem({
                product: product("Farinha de trigo"),
                quantity: "1250.5",
                minimumQuantity: "500",
                lastEntryCost: "4.5",
                averageCost: "4.25",
                value: "5314.63",
              }),
            ],
            totalValue: "5314.63",
          }),
        ),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    await screen.findByText("Farinha de trigo");
    const flour = rowOf("Farinha de trigo");

    expect(flour.getByText("1.250,5 kg")).toBeInTheDocument();
    expect(flour.getByText("500 kg")).toBeInTheDocument();
    expect(flour.getByText("R$ 4,50")).toBeInTheDocument();
    expect(flour.getByText("R$ 4,25")).toBeInTheDocument();
    expect(flour.getByText("R$ 5.314,63")).toBeInTheDocument();
    expect(flour.getByText("OK")).toBeInTheDocument();
  });

  it("names each situation in Portuguese", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(
          aStockPosition({
            items: [
              aStockItem({ product: product("Açúcar"), status: "BELOW_MINIMUM" }),
              aStockItem({ product: product("Fermento"), status: "NEGATIVE", quantity: "-3" }),
              aStockItem({ product: product("Sal"), status: "EMPTY", quantity: "0" }),
              aStockItem({ product: product("Leite"), status: "EXPIRED" }),
              aStockItem({ product: product("Manteiga"), status: "EXPIRING_SOON" }),
            ],
          }),
        ),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    await screen.findByText("Açúcar");
    expect(rowOf("Leite").getByText("Vencido")).toBeInTheDocument();
    expect(rowOf("Manteiga").getByText("Vence em breve")).toBeInTheDocument();
    expect(rowOf("Açúcar").getByText("Abaixo do mínimo")).toBeInTheDocument();
    expect(rowOf("Fermento").getByText("Negativo")).toBeInTheDocument();
    expect(rowOf("Fermento").getByText("-3 kg")).toBeInTheDocument();
    expect(rowOf("Sal").getByText("Zerado")).toBeInTheDocument();
  });

  it("leaves a dash where a product has no minimum and never had a cost", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(
          aStockPosition({
            items: [
              aStockItem({
                product: product("Sal"),
                quantity: "0",
                minimumQuantity: null,
                lastEntryCost: null,
                averageCost: null,
                value: "0.00",
                status: "EMPTY",
              }),
            ],
          }),
        ),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    await screen.findByText("Sal");
    expect(rowOf("Sal").getAllByText("—")).toHaveLength(4);
    expect(rowOf("Sal").getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("shows what the whole stock is worth and how many products need attention", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(
          aStockPosition({
            items: [
              aStockItem({ product: product("Farinha de trigo") }),
              aStockItem({ product: product("Açúcar"), status: "BELOW_MINIMUM" }),
              aStockItem({ product: product("Fermento"), status: "NEGATIVE" }),
              aStockItem({ product: product("Sal"), status: "EMPTY" }),
            ],
            totalValue: "12345.60",
          }),
        ),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    const summary = within(await screen.findByRole("group", { name: "Resumo do estoque" }));
    expect(summary.getByText("R$ 12.345,60")).toBeInTheDocument();
    expect(within(summary.getByText("Produtos").parentElement!).getByText("4")).toBeInTheDocument();
    expect(within(summary.getByText("Pedem atenção").parentElement!).getByText("3")).toBeInTheDocument();
  });

  it("shows only what needs attention when asked, and everything again when asked back", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(
          aStockPosition({
            items: [
              aStockItem({ product: product("Farinha de trigo") }),
              aStockItem({ product: product("Açúcar"), status: "BELOW_MINIMUM" }),
            ],
          }),
        ),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Só o que pede atenção" }));

    expect(screen.getByText("Açúcar")).toBeInTheDocument();
    expect(screen.queryByText("Farinha de trigo")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Só o que pede atenção" }));

    expect(screen.getByText("Farinha de trigo")).toBeInTheDocument();
  });

  it("says nothing needs attention instead of showing a bare table", async () => {
    server.use(http.get(apiUrl("/stock"), () => HttpResponse.json(aStockPosition({ items: [aStockItem()] }))));

    renderWithProviders(<StockPositionPage />);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Só o que pede atenção" }));

    expect(screen.getByText("Nenhum produto pede atenção.")).toBeInTheDocument();
  });

  it("says the catalog is empty instead of showing a bare table", async () => {
    server.use(http.get(apiUrl("/stock"), () => HttpResponse.json(aStockPosition({ items: [], totalValue: "0.00" }))));

    renderWithProviders(<StockPositionPage />);

    expect(await screen.findByText("Nenhum produto cadastrado ainda.")).toBeInTheDocument();
  });

  it("offers a way out when the position fails to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/stock"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json(aStockPosition());
      }),
    );

    renderWithProviders(<StockPositionPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Farinha de trigo")).toBeInTheDocument();
  });

  it("tells how many lots a product holds and when the next one expires", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(
          aStockPosition({
            items: [aStockItem({ product: product("Leite"), lotCount: 3, nextExpiresAt: "2026-12-31" })],
          }),
        ),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    await screen.findByText("Leite");
    expect(rowOf("Leite").getByText("3")).toBeInTheDocument();
    expect(rowOf("Leite").getByText("31/12/2026")).toBeInTheDocument();
  });

  it("leads from a product to its lots", async () => {
    server.use(
      http.get(apiUrl("/stock"), () =>
        HttpResponse.json(aStockPosition({ items: [aStockItem({ product: product("Leite") })] })),
      ),
    );

    renderWithProviders(<StockPositionPage />);

    expect(await screen.findByRole("link", { name: "Leite" })).toHaveAttribute("href", "/stock/sku-Leite");
  });
});
