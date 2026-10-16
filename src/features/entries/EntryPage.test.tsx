import { HttpResponse, http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EntryPage } from "@/features/entries/EntryPage";
import { stockKeys } from "@/features/stock/stock.api";
import { stockMovementsKeys } from "@/features/stock-movements/stock-movements.api";
import { todayIso } from "@/lib/dates";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aProduct, aStockPosition, aSupplier, anEntry } from "@/tests/samples";

const FLOUR = aProduct({ sku: "018f0000-0000-7000-8000-000000000020", description: "Farinha de trigo" });
const MILL = aSupplier({ id: "018f0000-0000-7000-8000-000000000050", name: "Moinho Santa Clara" });

function withCatalog(products = [FLOUR], suppliers = [MILL]) {
  server.use(
    http.get(apiUrl("/products"), () => HttpResponse.json(products)),
    http.get(apiUrl("/suppliers"), () => HttpResponse.json(suppliers)),
  );
}

/** Captures what the screen posts and answers every attempt with `respond`. */
function recordingEntries(respond: (body: Record<string, unknown>) => Response) {
  const received: Record<string, unknown>[] = [];
  server.use(
    http.post(apiUrl("/entries"), async ({ request: incoming }) => {
      const body = (await incoming.json()) as Record<string, unknown>;
      received.push(body);
      return respond(body);
    }),
  );

  return received;
}

const created = () => HttpResponse.json(anEntry(), { status: 201 });

async function fillEntry({ quantity = "10", unitCost = "4", expiresAt = "" as string | null } = {}) {
  await userEvent.selectOptions(await screen.findByLabelText("Produto"), "Farinha de trigo (kg)");
  await userEvent.type(screen.getByLabelText("Quantidade"), quantity);
  await userEvent.type(screen.getByLabelText("Custo unitário"), unitCost);

  if (expiresAt === null) await userEvent.click(screen.getByRole("checkbox", { name: "Sem data de validade" }));
  else if (expiresAt !== "") await userEvent.type(screen.getByLabelText("Validade"), expiresAt);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Lançar entrada" }));

describe("EntryPage", () => {
  it("offers only the active products, each with its unit", async () => {
    withCatalog([
      FLOUR,
      aProduct({ sku: "018f0000-0000-7000-8000-000000000021", description: "Fermento", isActive: false }),
    ]);

    renderWithProviders(<EntryPage />);

    expect(await screen.findByRole("option", { name: "Farinha de trigo (kg)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Fermento/ })).not.toBeInTheDocument();
  });

  it("says there is nothing to receive when no product is active", async () => {
    withCatalog([]);

    renderWithProviders(<EntryPage />);

    expect(await screen.findByText("Nenhum produto ativo cadastrado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lançar entrada" })).not.toBeInTheDocument();
  });

  it("offers a way out when the catalog fails to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/suppliers"), () => HttpResponse.json([MILL])),
      http.get(apiUrl("/products"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([FLOUR]);
      }),
    );

    renderWithProviders(<EntryPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Produto")).toBeInTheDocument();
  });

  it("refuses an entry with no product, a zero quantity, no cost and nothing said about the expiry", async () => {
    withCatalog();

    renderWithProviders(<EntryPage />);

    await screen.findByLabelText("Produto");
    await userEvent.type(screen.getByLabelText("Quantidade"), "0");
    await submit();

    expect(await screen.findByText("Escolha o produto.")).toBeInTheDocument();
    expect(screen.getByText("A quantidade deve ser maior que zero.")).toBeInTheDocument();
    expect(screen.getByText("Informe o custo unitário, com até 6 casas decimais.")).toBeInTheDocument();
    expect(screen.getByText('Informe a validade ou marque "Sem data de validade".')).toBeInTheDocument();
  });

  it("shows the cost as money and the quantity in the product's unit, and sends plain decimals", async () => {
    withCatalog();
    const received = recordingEntries(created);

    renderWithProviders(<EntryPage />);
    await fillEntry({ quantity: "1250,5", unitCost: "1234,5", expiresAt: null });

    const quantity = screen.getByLabelText("Quantidade");
    const unitCost = screen.getByLabelText("Custo unitário");
    expect(quantity).toHaveValue("1.250,5");
    expect(within(quantity.parentElement!).getByText("kg")).toBeInTheDocument();
    expect(unitCost).toHaveValue("1.234,50");
    expect(within(unitCost.parentElement!).getByText("R$")).toBeInTheDocument();

    await submit();

    await waitFor(() => expect(received[0]).toMatchObject({ quantity: "1250.5", unitCost: "1234.50" }));
  });

  it("refuses a lot that has already expired", async () => {
    withCatalog();

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: "2020-01-01" });
    await submit();

    expect(await screen.findByText("A validade não pode ser anterior a hoje.")).toBeInTheDocument();
  });

  it("accepts a lot that expires today", async () => {
    withCatalog();
    const received = recordingEntries(created);

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: todayIso() });
    await submit();

    await waitFor(() => expect(received[0]).toMatchObject({ expiresAt: todayIso() }));
  });

  it("sends the entry with decimal points, the expiry and the supplier", async () => {
    withCatalog();
    const received = recordingEntries(created);

    renderWithProviders(<EntryPage />);
    await fillEntry({ quantity: "10,5", unitCost: "4,25", expiresAt: "2099-12-31" });
    await userEvent.selectOptions(screen.getByLabelText("Fornecedor (opcional)"), "Moinho Santa Clara");
    await submit();

    await waitFor(() =>
      expect(received).toEqual([
        { productSku: FLOUR.sku, quantity: "10.5", unitCost: "4.25", expiresAt: "2099-12-31", supplierId: MILL.id },
      ]),
    );
  });

  it("sends a lot that never expires and has no supplier as such", async () => {
    withCatalog();
    const received = recordingEntries(created);

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: null });
    await submit();

    await waitFor(() =>
      expect(received).toEqual([{ productSku: FLOUR.sku, quantity: "10", unitCost: "4.00", expiresAt: null }]),
    );
  });

  it("stops asking for the date once the lot is said not to expire", async () => {
    withCatalog();

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: "2099-12-31" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Sem data de validade" }));

    expect(screen.getByLabelText("Validade")).toBeDisabled();
    expect(screen.getByLabelText("Validade")).toHaveValue("");
  });

  it("shows the lot that was opened and where the stock landed", async () => {
    withCatalog();
    recordingEntries(() =>
      HttpResponse.json(
        anEntry({
          quantity: "10.5",
          product: { sku: FLOUR.sku, description: "Farinha de trigo", unit: "KILOGRAM" },
          lot: { id: "lot-1", expiresAt: "2099-12-31", supplier: MILL, quantity: "10.5" },
          stock: { quantity: "40.5", lastEntryCost: "4.25", averageCost: "5.5" },
        }),
        { status: 201 },
      ),
    );

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: "2099-12-31" });
    await submit();

    const result = within(await screen.findByRole("status"));
    expect(result.getByText("Entrada lançada: 10,5 kg de Farinha de trigo.")).toBeInTheDocument();
    expect(result.getByText("31/12/2099")).toBeInTheDocument();
    expect(result.getByText("Moinho Santa Clara")).toBeInTheDocument();
    expect(result.getByText("40,5 kg")).toBeInTheDocument();
    expect(result.getByText("R$ 4,25")).toBeInTheDocument();
    expect(result.getByText("R$ 5,50")).toBeInTheDocument();
  });

  it("says the lot has no expiry and no supplier when it has none", async () => {
    withCatalog();
    recordingEntries(created);

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: null });
    await submit();

    const result = within(await screen.findByRole("status"));
    expect(result.getByText("Sem validade")).toBeInTheDocument();
    expect(result.getByText("—")).toBeInTheDocument();
  });

  it("clears the form after an entry, ready for the next one", async () => {
    withCatalog();
    recordingEntries(created);

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: null });
    await submit();

    await screen.findByRole("status");
    expect(screen.getByLabelText("Produto")).toHaveValue("");
    expect(screen.getByLabelText("Quantidade")).toHaveValue("");
    expect(screen.getByLabelText("Custo unitário")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Sem data de validade" })).not.toBeChecked();
  });

  it("says the product is inactive, in Portuguese, and keeps what was typed", async () => {
    withCatalog();
    recordingEntries(() => HttpResponse.json({ message: "Product is inactive." }, { status: 409 }));

    renderWithProviders(<EntryPage />);
    await fillEntry({ expiresAt: null });
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Esse produto está inativo e não recebe entradas.");
    expect(screen.getByLabelText("Quantidade")).toHaveValue("10");
  });

  describe("on a product whose balance is negative", () => {
    const owing = () =>
      recordingEntries((body) =>
        body.deficit === undefined
          ? HttpResponse.json(
              { message: "The product has a negative balance to settle.", deficit: "3.5" },
              { status: 409 },
            )
          : created(),
      );

    it("shows what is owed and asks how to settle it before recording anything", async () => {
      withCatalog();
      owing();

      renderWithProviders(<EntryPage />);
      await fillEntry({ expiresAt: null });
      await submit();

      const dialog = within(await screen.findByRole("alertdialog"));
      expect(dialog.getByText(/Farinha de trigo está com o estoque negativo em 3,5 kg/)).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("records the entry over a zeroed balance when asked to", async () => {
      withCatalog();
      const received = owing();

      renderWithProviders(<EntryPage />);
      await fillEntry({ expiresAt: null });
      await submit();
      await userEvent.click(await screen.findByRole("button", { name: "Zerar o saldo antes" }));

      await screen.findByRole("status");
      expect(received[1]).toEqual({
        productSku: FLOUR.sku,
        quantity: "10",
        unitCost: "4.00",
        expiresAt: null,
        deficit: "ZERO",
      });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("records the entry paying what is owed when asked to", async () => {
      withCatalog();
      const received = owing();

      renderWithProviders(<EntryPage />);
      await fillEntry({ expiresAt: null });
      await submit();
      await userEvent.click(await screen.findByRole("button", { name: "Descontar da entrada" }));

      await screen.findByRole("status");
      expect(received[1]).toMatchObject({ deficit: "DISCOUNT" });
    });

    it("records nothing and keeps what was typed when the operator backs out", async () => {
      withCatalog();
      const received = owing();

      renderWithProviders(<EntryPage />);
      await fillEntry({ expiresAt: null });
      await submit();
      await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(received).toHaveLength(1);
      expect(screen.getByLabelText("Quantidade")).toHaveValue("10");
    });
  });

  it("drops the cached movement history and stock position after an entry, so both show it", async () => {
    withCatalog();
    recordingEntries(created);
    const queryClient = new QueryClient();
    queryClient.setQueryData(stockMovementsKeys.list(undefined), { pages: [], pageParams: [] });
    queryClient.setQueryData(stockKeys.all, aStockPosition());

    render(
      <QueryClientProvider client={queryClient}>
        <EntryPage />
      </QueryClientProvider>,
    );
    await fillEntry({ expiresAt: null });
    await submit();

    await screen.findByRole("status");
    expect(queryClient.getQueryState(stockMovementsKeys.list(undefined))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(stockKeys.all)?.isInvalidated).toBe(true);
  });
});
