import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RecipePage } from "@/features/recipes/RecipePage";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aProduct, aRecipe } from "@/tests/samples";

const BREAD = aProduct({
  sku: "018f0000-0000-7000-8000-000000000090",
  description: "Pão francês",
  kind: "MANUFACTURED",
});
const FLOUR = aProduct();
const SALT = aProduct({ sku: "018f0000-0000-7000-8000-000000000021", description: "Sal", unit: "GRAM" });

const summaryOf = ({ sku, description, unit }: typeof FLOUR) => ({ sku, description, unit });

const NO_RECIPE = () => HttpResponse.json({ message: "Recipe not found." }, { status: 404 });

function withCatalog(products = [BREAD, FLOUR, SALT]) {
  server.use(http.get(apiUrl("/products"), () => HttpResponse.json(products)));
}

/** Answers every read of the recipe of the bread with `respond`. */
function withRecipe(respond: () => Response = NO_RECIPE) {
  server.use(http.get(apiUrl(`/products/${BREAD.sku}/recipe`), respond));
}

/** Captures what the screen sends and answers every attempt with `respond`. */
function saving(respond: () => Response = () => HttpResponse.json(aRecipe())) {
  const received: unknown[] = [];
  server.use(
    http.put(apiUrl(`/products/${BREAD.sku}/recipe`), async ({ request: incoming }) => {
      received.push(await incoming.json());
      return respond();
    }),
  );

  return received;
}

async function chooseBread() {
  await userEvent.selectOptions(await screen.findByLabelText("Produto"), "Pão francês (kg)");
  await screen.findByRole("heading", { name: /de Pão francês$/ });
}

async function fillIngredient(position: number, product: string, quantity: string) {
  await userEvent.selectOptions(screen.getByLabelText(`Ingrediente ${position}`), product);
  await userEvent.type(screen.getByLabelText(`Quantidade do ingrediente ${position}`), quantity);
}

const addIngredient = () => userEvent.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
const save = () => userEvent.click(screen.getByRole("button", { name: "Salvar receita" }));

describe("RecipePage", () => {
  it("offers only the active products that are manufactured, each with its unit", async () => {
    withCatalog([BREAD, FLOUR, aProduct({ sku: "sku-3", description: "Bolo", kind: "MANUFACTURED", isActive: false })]);

    renderWithProviders(<RecipePage />);

    const product = await screen.findByLabelText("Produto");
    expect(product).toHaveTextContent("Pão francês (kg)");
    expect(product).not.toHaveTextContent("Farinha");
    expect(product).not.toHaveTextContent("Bolo");
  });

  it("says there is nothing to write a recipe for when no manufactured product is active", async () => {
    withCatalog([FLOUR]);

    renderWithProviders(<RecipePage />);

    expect(await screen.findByText("Nenhum produto fabricado ativo cadastrado.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Produto")).not.toBeInTheDocument();
  });

  it("offers a way out when the catalog fails to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/products"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([BREAD]);
      }),
    );

    renderWithProviders(<RecipePage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Produto")).toBeInTheDocument();
  });

  it("starts a blank recipe for a product that has none", async () => {
    withCatalog();
    withRecipe();

    renderWithProviders(<RecipePage />);
    await chooseBread();

    expect(screen.getByRole("heading", { name: "Nova receita de Pão francês" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rendimento (kg)")).toHaveValue("");
    expect(screen.getByLabelText("Ingrediente 1")).toHaveValue("");
    expect(screen.getByLabelText("Quantidade do ingrediente 1")).toHaveValue("");
    expect(screen.queryByLabelText("Ingrediente 2")).not.toBeInTheDocument();
  });

  it("offers every active product as an ingredient, except the one the recipe makes", async () => {
    withCatalog([BREAD, FLOUR, SALT, aProduct({ sku: "sku-4", description: "Fermento", isActive: false })]);
    withRecipe();

    renderWithProviders(<RecipePage />);
    await chooseBread();

    const ingredient = screen.getByLabelText("Ingrediente 1");
    expect(ingredient).toHaveTextContent("Farinha de trigo (kg)");
    expect(ingredient).toHaveTextContent("Sal (g)");
    expect(ingredient).not.toHaveTextContent("Pão francês");
    expect(ingredient).not.toHaveTextContent("Fermento");
  });

  it("opens the recipe a product already has, written the Portuguese way", async () => {
    withCatalog();
    withRecipe(() =>
      HttpResponse.json(
        aRecipe({
          yieldQuantity: "10.5",
          ingredients: [
            { product: summaryOf(FLOUR), quantity: "6.25" },
            { product: summaryOf(SALT), quantity: "120" },
          ],
        }),
      ),
    );

    renderWithProviders(<RecipePage />);
    await chooseBread();

    expect(screen.getByRole("heading", { name: "Receita de Pão francês" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rendimento (kg)")).toHaveValue("10,5");
    expect(screen.getByLabelText("Ingrediente 1")).toHaveValue(FLOUR.sku);
    expect(screen.getByLabelText("Quantidade do ingrediente 1")).toHaveValue("6,25");
    expect(screen.getByLabelText("Ingrediente 2")).toHaveValue(SALT.sku);
    expect(screen.getByLabelText("Quantidade do ingrediente 2")).toHaveValue("120");
  });

  // The API refuses a recipe with an inactive ingredient, but the one already in it has to stay
  // on the screen for the operator to see what to take out.
  it("keeps an ingredient that went inactive in the recipe it is already in, marked as such", async () => {
    const yeast = aProduct({ sku: "018f0000-0000-7000-8000-000000000022", description: "Fermento", isActive: false });
    withCatalog([BREAD, FLOUR, yeast]);
    withRecipe(() => HttpResponse.json(aRecipe({ ingredients: [{ product: summaryOf(yeast), quantity: "1" }] })));

    renderWithProviders(<RecipePage />);
    await chooseBread();

    expect(screen.getByLabelText("Ingrediente 1")).toHaveValue(yeast.sku);
    expect(screen.getByRole("option", { name: "Fermento (kg) — inativo" })).toBeInTheDocument();
  });

  it("offers a way out when the recipe fails to load", async () => {
    withCatalog();
    let attempts = 0;
    withRecipe(() => {
      attempts += 1;
      return attempts === 1 ? new HttpResponse(null, { status: 502 }) : NO_RECIPE();
    });

    renderWithProviders(<RecipePage />);
    await userEvent.selectOptions(await screen.findByLabelText("Produto"), "Pão francês (kg)");
    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("heading", { name: "Nova receita de Pão francês" })).toBeInTheDocument();
  });

  it("shows the unit of the ingredient chosen beside its quantity", async () => {
    withCatalog();
    withRecipe();

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.selectOptions(screen.getByLabelText("Ingrediente 1"), "Sal (g)");

    expect(screen.getByTestId("ingredient-unit-1")).toHaveTextContent("g");
  });

  it("refuses to save without a yield, an ingredient and its quantity", async () => {
    withCatalog();
    withRecipe();
    const received = saving();

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await save();

    expect(await screen.findByText("Informe o rendimento, com até 6 casas decimais.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o ingrediente.")).toBeInTheDocument();
    expect(screen.getByText("Informe a quantidade, com até 6 casas decimais.")).toBeInTheDocument();
    expect(received).toEqual([]);
  });

  it("refuses a zero yield and a zero quantity", async () => {
    withCatalog();
    withRecipe();
    const received = saving();

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.type(screen.getByLabelText("Rendimento (kg)"), "0");
    await fillIngredient(1, "Sal (g)", "0");
    await save();

    expect(await screen.findByText("O rendimento deve ser maior que zero.")).toBeInTheDocument();
    expect(screen.getByText("A quantidade deve ser maior que zero.")).toBeInTheDocument();
    expect(received).toEqual([]);
  });

  it("refuses the same ingredient twice", async () => {
    withCatalog();
    withRecipe();
    const received = saving();

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.type(screen.getByLabelText("Rendimento (kg)"), "10");
    await fillIngredient(1, "Sal (g)", "100");
    await addIngredient();
    await fillIngredient(2, "Sal (g)", "20");
    await save();

    expect(await screen.findByText("Cada ingrediente só pode aparecer uma vez.")).toBeInTheDocument();
    expect(received).toEqual([]);
  });

  it("saves the yield and each ingredient, with decimal points", async () => {
    withCatalog();
    withRecipe();
    const received = saving();

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.type(screen.getByLabelText("Rendimento (kg)"), "10,5");
    await fillIngredient(1, "Farinha de trigo (kg)", "6,25");
    await addIngredient();
    await fillIngredient(2, "Sal (g)", "120");
    await save();

    await waitFor(() =>
      expect(received).toEqual([
        {
          yieldQuantity: "10.5",
          ingredients: [
            { productSku: FLOUR.sku, quantity: "6.25" },
            { productSku: SALT.sku, quantity: "120" },
          ],
        },
      ]),
    );
  });

  it("leaves out an ingredient that was removed", async () => {
    withCatalog();
    withRecipe(() =>
      HttpResponse.json(
        aRecipe({
          ingredients: [
            { product: summaryOf(FLOUR), quantity: "6" },
            { product: summaryOf(SALT), quantity: "120" },
          ],
        }),
      ),
    );
    const received = saving();

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.click(screen.getByRole("button", { name: "Remover ingrediente 1" }));
    await save();

    await waitFor(() =>
      expect(received).toEqual([{ yieldQuantity: "10", ingredients: [{ productSku: SALT.sku, quantity: "120" }] }]),
    );
  });

  it("does not let the only ingredient be removed", async () => {
    withCatalog();
    withRecipe();

    renderWithProviders(<RecipePage />);
    await chooseBread();

    expect(screen.getByRole("button", { name: "Remover ingrediente 1" })).toBeDisabled();
  });

  it("shows the saved recipe as the one the product now has", async () => {
    withCatalog();
    withRecipe();
    saving(() =>
      HttpResponse.json(
        aRecipe({ yieldQuantity: "10.5", ingredients: [{ product: summaryOf(SALT), quantity: "120" }] }),
      ),
    );

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.type(screen.getByLabelText("Rendimento (kg)"), "10,5");
    await fillIngredient(1, "Sal (g)", "120");
    await save();

    expect(await screen.findByRole("heading", { name: "Receita de Pão francês" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rendimento (kg)")).toHaveValue("10,5");
    expect(screen.getByLabelText("Ingrediente 1")).toHaveValue(SALT.sku);
  });

  it.each([
    [404, "O produto ou um ingrediente não existe mais. Atualize a página."],
    [
      409,
      "Não foi possível salvar: o produto ou um ingrediente está inativo, ou um ingrediente leva este produto na própria receita.",
    ],
  ])("explains a %i from the API and keeps what was typed", async (status, message) => {
    withCatalog();
    withRecipe();
    saving(() => HttpResponse.json({ message: "Refused." }, { status }));

    renderWithProviders(<RecipePage />);
    await chooseBread();
    await userEvent.type(screen.getByLabelText("Rendimento (kg)"), "10");
    await fillIngredient(1, "Sal (g)", "120");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Rendimento (kg)")).toHaveValue("10");
  });
});
