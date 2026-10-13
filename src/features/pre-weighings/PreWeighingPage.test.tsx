import { HttpResponse, http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PreWeighingPage } from "@/features/pre-weighings/PreWeighingPage";
import { preWeighingsKeys } from "@/features/pre-weighings/pre-weighings.api";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aPreWeighing, aPreWeighingPlan, aProduct } from "@/tests/samples";

const BREAD = aProduct({
  sku: "018f0000-0000-7000-8000-000000000090",
  description: "Pão francês",
  kind: "MANUFACTURED",
});
const FLOUR = {
  sku: "018f0000-0000-7000-8000-000000000020",
  description: "Farinha de trigo",
  unit: "KILOGRAM",
} as const;
const SALT = { sku: "018f0000-0000-7000-8000-000000000021", description: "Sal", unit: "GRAM" } as const;

const TWO_INGREDIENTS = aPreWeighingPlan({
  items: [
    {
      product: FLOUR,
      plannedQuantity: "6",
      lots: [
        { id: "lot-1", expiresAt: "2099-12-31", quantity: "4.5" },
        { id: "lot-2", expiresAt: null, quantity: "1.5" },
      ],
      shortfall: "0",
    },
    {
      product: SALT,
      plannedQuantity: "120",
      lots: [{ id: "lot-3", expiresAt: null, quantity: "100" }],
      shortfall: "20",
    },
  ],
});

function withCatalog(products = [BREAD]) {
  server.use(http.get(apiUrl("/products"), () => HttpResponse.json(products)));
}

/** Captures what the screen asks the plan for and answers every attempt with `respond`. */
function planning(respond: () => Response = () => HttpResponse.json(TWO_INGREDIENTS)) {
  const asked: Record<string, string>[] = [];
  server.use(
    http.get(apiUrl("/pre-weighings/plan"), ({ request: incoming }) => {
      asked.push(Object.fromEntries(new URL(incoming.url).searchParams));
      return respond();
    }),
  );

  return asked;
}

/** Captures what the screen posts and answers every attempt with `respond`. */
function recording(respond: () => Response = () => HttpResponse.json(aPreWeighing(), { status: 201 })) {
  const received: unknown[] = [];
  server.use(
    http.post(apiUrl("/pre-weighings"), async ({ request: incoming }) => {
      received.push(await incoming.json());
      return respond();
    }),
  );

  return received;
}

async function calculate(quantity = "10") {
  await userEvent.selectOptions(await screen.findByLabelText("Produto"), "Pão francês (kg)");
  await userEvent.type(screen.getByLabelText("Quantidade a produzir"), quantity);
  await userEvent.click(screen.getByRole("button", { name: "Calcular" }));
}

async function weigh(flour: string, salt: string) {
  await userEvent.type(await screen.findByLabelText("Pesado de Farinha de trigo"), flour);
  await userEvent.type(screen.getByLabelText("Pesado de Sal"), salt);
}

const record = () => userEvent.click(screen.getByRole("button", { name: "Registrar pré-pesagem" }));

describe("PreWeighingPage", () => {
  it("offers only the active products that are manufactured, each with its unit", async () => {
    withCatalog([
      BREAD,
      aProduct({ sku: "sku-2", description: "Farinha de trigo", kind: "GOODS" }),
      aProduct({ sku: "sku-3", description: "Bolo", kind: "MANUFACTURED", isActive: false }),
    ]);

    renderWithProviders(<PreWeighingPage />);

    expect(await screen.findByRole("option", { name: "Pão francês (kg)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Farinha/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Bolo/ })).not.toBeInTheDocument();
  });

  it("says there is nothing to pre-weigh when no manufactured product is active", async () => {
    withCatalog([aProduct({ kind: "GOODS" })]);

    renderWithProviders(<PreWeighingPage />);

    expect(await screen.findByText("Nenhum produto fabricado ativo cadastrado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calcular" })).not.toBeInTheDocument();
  });

  it("offers a way out when the catalog fails to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/products"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([BREAD]);
      }),
    );

    renderWithProviders(<PreWeighingPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Produto")).toBeInTheDocument();
  });

  it("refuses to calculate with no product and a zero quantity", async () => {
    withCatalog();
    const asked = planning();

    renderWithProviders(<PreWeighingPage />);

    await userEvent.type(await screen.findByLabelText("Quantidade a produzir"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(await screen.findByText("Escolha o produto.")).toBeInTheDocument();
    expect(screen.getByText("A quantidade deve ser maior que zero.")).toBeInTheDocument();
    expect(asked).toEqual([]);
  });

  it("asks the plan for the quantity with a decimal point", async () => {
    withCatalog();
    const asked = planning();

    renderWithProviders(<PreWeighingPage />);
    await calculate("10,5");

    await waitFor(() => expect(asked).toEqual([{ productSku: BREAD.sku, quantity: "10.5" }]));
  });

  it("shows how much to weigh of each ingredient and the lots to weigh it from", async () => {
    withCatalog();
    planning();

    renderWithProviders(<PreWeighingPage />);
    await calculate();

    expect(await screen.findByRole("heading", { name: "Plano para 10 kg de Pão francês" })).toBeInTheDocument();

    const [, flour, salt] = screen.getAllByRole("row");
    expect(within(flour!).getByText("Farinha de trigo")).toBeInTheDocument();
    expect(within(flour!).getByText("6 kg")).toBeInTheDocument();
    expect(within(flour!).getByText("4,5 kg — validade 31/12/2099")).toBeInTheDocument();
    expect(within(flour!).getByText("1,5 kg — sem validade")).toBeInTheDocument();
    expect(within(salt!).getByText("120 g")).toBeInTheDocument();
  });

  it("warns of the ingredient the stock does not cover, without stopping the record", async () => {
    withCatalog();
    planning();
    const received = recording();

    renderWithProviders(<PreWeighingPage />);
    await calculate();

    const [, flour, salt] = await screen.findAllByRole("row");
    expect(within(salt!).getByText("Faltam 20 g")).toBeInTheDocument();
    expect(within(flour!).queryByText(/Faltam/)).not.toBeInTheDocument();

    await weigh("6", "100");
    await record();

    await waitFor(() => expect(received).toHaveLength(1));
  });

  it("says no lot has the ingredient when the stock has none of it", async () => {
    withCatalog();
    planning(() =>
      HttpResponse.json(
        aPreWeighingPlan({ items: [{ product: SALT, plannedQuantity: "120", lots: [], shortfall: "120" }] }),
      ),
    );

    renderWithProviders(<PreWeighingPage />);
    await calculate();

    const [, salt] = await screen.findAllByRole("row");
    expect(within(salt!).getByText("Nenhum lote com saldo")).toBeInTheDocument();
    expect(within(salt!).getByText("Faltam 120 g")).toBeInTheDocument();
  });

  it("starts every weighed quantity blank, for the operator to type what the scale showed", async () => {
    withCatalog();
    planning();

    renderWithProviders(<PreWeighingPage />);
    await calculate();

    expect(await screen.findByLabelText("Pesado de Farinha de trigo")).toHaveValue("");
    expect(screen.getByLabelText("Pesado de Sal")).toHaveValue("");
  });

  it("refuses to record while an ingredient has no weighed quantity", async () => {
    withCatalog();
    planning();
    const received = recording();

    renderWithProviders(<PreWeighingPage />);
    await calculate();
    await userEvent.type(await screen.findByLabelText("Pesado de Farinha de trigo"), "6");
    await record();

    expect(await screen.findByText("Informe o pesado, com até 6 casas decimais.")).toBeInTheDocument();
    expect(received).toEqual([]);
  });

  it("records what was weighed of each ingredient, with decimal points", async () => {
    withCatalog();
    planning();
    const received = recording();

    renderWithProviders(<PreWeighingPage />);
    await calculate("10,5");
    await weigh("6,05", "118,5");
    await record();

    await waitFor(() =>
      expect(received).toEqual([
        {
          productSku: BREAD.sku,
          quantity: "10.5",
          items: [
            { productSku: FLOUR.sku, weighedQuantity: "6.05" },
            { productSku: SALT.sku, weighedQuantity: "118.5" },
          ],
        },
      ]),
    );
  });

  it("confirms the record, leads to it and clears the screen for the next one", async () => {
    withCatalog();
    planning();
    recording(() => HttpResponse.json(aPreWeighing({ id: "pre-weighing-1", quantity: "10" }), { status: 201 }));

    renderWithProviders(<PreWeighingPage />);
    await calculate();
    await weigh("6", "120");
    await record();

    const result = within(await screen.findByRole("status"));
    expect(result.getByText("Pré-pesagem registrada: 10 kg de Pão francês.")).toBeInTheDocument();
    expect(result.getByRole("link", { name: "Ver a pré-pesagem" })).toHaveAttribute(
      "href",
      "/pre-weighings/pre-weighing-1",
    );
    expect(screen.getByLabelText("Produto")).toHaveValue("");
    expect(screen.getByLabelText("Quantidade a produzir")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Registrar pré-pesagem" })).not.toBeInTheDocument();
  });

  it("says why there is no plan when the product cannot be pre-weighed, without offering to try again", async () => {
    withCatalog();
    planning(() => HttpResponse.json({ message: "Product has no recipe." }, { status: 409 }));

    renderWithProviders(<PreWeighingPage />);
    await calculate();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível calcular: o produto não tem receita, a receita usa um produto inativo ou a quantidade está fora do que a receita alcança.",
    );
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade a produzir")).toHaveValue("10");
  });

  it("offers a way out when the plan fails to load", async () => {
    withCatalog();
    let attempts = 0;
    planning(() => {
      attempts += 1;
      return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json(TWO_INGREDIENTS);
    });

    renderWithProviders(<PreWeighingPage />);
    await calculate();
    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Pesado de Sal")).toBeInTheDocument();
  });

  it("asks the stock again, and blanks what was weighed, when the same plan is calculated twice", async () => {
    withCatalog();
    const asked = planning();

    renderWithProviders(<PreWeighingPage />);
    await calculate();
    await userEvent.type(await screen.findByLabelText("Pesado de Sal"), "120");
    await userEvent.click(screen.getByRole("button", { name: "Calcular" }));

    await waitFor(() => expect(asked).toHaveLength(2));
    await waitFor(() => expect(screen.getByLabelText("Pesado de Sal")).toHaveValue(""));
  });

  it("says the recipe changed since the plan, in Portuguese, and keeps what was weighed", async () => {
    withCatalog();
    planning();
    recording(() =>
      HttpResponse.json({ message: "The items do not match the ingredients of the recipe." }, { status: 409 }),
    );

    renderWithProviders(<PreWeighingPage />);
    await calculate();
    await weigh("6", "120");
    await record();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A receita ou o produto mudou desde que o plano foi calculado. Calcule de novo.",
    );
    expect(screen.getByLabelText("Pesado de Sal")).toHaveValue("120");
  });

  it("drops the cached list after a record, so it shows the new one", async () => {
    withCatalog();
    planning();
    recording();
    const queryClient = new QueryClient();
    queryClient.setQueryData(preWeighingsKeys.list(), { pages: [], pageParams: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PreWeighingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await calculate();
    await weigh("6", "120");
    await record();

    await screen.findByRole("status");
    expect(queryClient.getQueryState(preWeighingsKeys.list())?.isInvalidated).toBe(true);
  });
});
