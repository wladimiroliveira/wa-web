import { HttpResponse, http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EntryPage } from "@/features/entries/EntryPage";
import { stockMovementsKeys } from "@/features/stock-movements/stock-movements.api";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aProduct, anEntry } from "@/tests/samples";

const FLOUR = aProduct({ sku: "018f0000-0000-7000-8000-000000000020", description: "Farinha de trigo" });

function withProducts(products = [FLOUR]) {
  server.use(http.get(apiUrl("/products"), () => HttpResponse.json(products)));
}

async function fillEntry(quantity: string, unitCost: string) {
  await userEvent.selectOptions(await screen.findByLabelText("Produto"), "Farinha de trigo (kg)");
  await userEvent.type(screen.getByLabelText("Quantidade"), quantity);
  await userEvent.type(screen.getByLabelText("Custo unitário"), unitCost);
  await userEvent.click(screen.getByRole("button", { name: "Lançar entrada" }));
}

describe("EntryPage", () => {
  it("offers only the active products, each with its unit", async () => {
    withProducts([
      FLOUR,
      aProduct({ sku: "018f0000-0000-7000-8000-000000000021", description: "Fermento", isActive: false }),
    ]);

    renderWithProviders(<EntryPage />);

    expect(await screen.findByRole("option", { name: "Farinha de trigo (kg)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Fermento/ })).not.toBeInTheDocument();
  });

  it("says there is nothing to receive when no product is active", async () => {
    withProducts([]);

    renderWithProviders(<EntryPage />);

    expect(await screen.findByText("Nenhum produto ativo cadastrado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lançar entrada" })).not.toBeInTheDocument();
  });

  it("offers a way out when the products fail to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/products"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([FLOUR]);
      }),
    );

    renderWithProviders(<EntryPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Produto")).toBeInTheDocument();
  });

  it("refuses an entry with no product, a zero quantity and no cost", async () => {
    withProducts();

    renderWithProviders(<EntryPage />);

    await screen.findByLabelText("Produto");
    await userEvent.type(screen.getByLabelText("Quantidade"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Lançar entrada" }));

    expect(await screen.findByText("Escolha o produto.")).toBeInTheDocument();
    expect(screen.getByText("A quantidade deve ser maior que zero.")).toBeInTheDocument();
    expect(screen.getByText("Informe o custo unitário, com até 6 casas decimais.")).toBeInTheDocument();
  });

  it("sends the entry with decimal points and shows where the stock landed", async () => {
    withProducts();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/entries"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(
          anEntry({
            quantity: "10.5",
            unitCost: "4.25",
            product: { sku: FLOUR.sku, description: "Farinha de trigo", unit: "KILOGRAM" },
            stock: { quantity: "40.5", lastEntryCost: "4.25", averageCost: "5.5" },
          }),
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<EntryPage />);
    await fillEntry("10,5", "4,25");

    await waitFor(() => expect(received).toEqual({ productSku: FLOUR.sku, quantity: "10.5", unitCost: "4.25" }));

    const result = within(await screen.findByRole("status"));
    expect(result.getByText("Entrada lançada: 10,5 kg de Farinha de trigo.")).toBeInTheDocument();
    expect(result.getByText("40,5 kg")).toBeInTheDocument();
    expect(result.getByText("R$ 4,25")).toBeInTheDocument();
    expect(result.getByText("R$ 5,50")).toBeInTheDocument();
  });

  it("clears the form after an entry, ready for the next one", async () => {
    withProducts();
    server.use(http.post(apiUrl("/entries"), () => HttpResponse.json(anEntry(), { status: 201 })));

    renderWithProviders(<EntryPage />);
    await fillEntry("10", "4");

    await screen.findByRole("status");
    expect(screen.getByLabelText("Produto")).toHaveValue("");
    expect(screen.getByLabelText("Quantidade")).toHaveValue("");
    expect(screen.getByLabelText("Custo unitário")).toHaveValue("");
  });

  it("says the product is inactive, in Portuguese, and keeps what was typed", async () => {
    withProducts();
    server.use(
      http.post(apiUrl("/entries"), () => HttpResponse.json({ message: "Product is inactive." }, { status: 409 })),
    );

    renderWithProviders(<EntryPage />);
    await fillEntry("10", "4");

    expect(await screen.findByRole("alert")).toHaveTextContent("Esse produto está inativo e não recebe entradas.");
    expect(screen.getByLabelText("Quantidade")).toHaveValue("10");
  });

  it("drops the cached movement history after an entry, so the new one shows up there", async () => {
    withProducts();
    server.use(http.post(apiUrl("/entries"), () => HttpResponse.json(anEntry(), { status: 201 })));
    const queryClient = new QueryClient();
    queryClient.setQueryData(stockMovementsKeys.list(undefined), { pages: [], pageParams: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <EntryPage />
      </QueryClientProvider>,
    );
    await fillEntry("10", "4");

    await screen.findByRole("status");
    expect(queryClient.getQueryState(stockMovementsKeys.list(undefined))?.isInvalidated).toBe(true);
  });
});
