import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RecipesListPage } from "@/features/recipes/RecipesListPage";
import type { Product, RecipeSummary } from "@/lib/api";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { chooseRowAction } from "@/tests/row-actions";
import { aProduct, aRecipe, aRecipeSummary } from "@/tests/samples";

const BREAD = aProduct({
  sku: "018f0000-0000-7000-8000-000000000090",
  description: "Pão francês",
  kind: "MANUFACTURED",
});
const CAKE = aProduct({
  sku: "018f0000-0000-7000-8000-000000000091",
  description: "Bolo de fubá",
  kind: "MANUFACTURED",
  unit: "UNIT",
});
const FLOUR = aProduct();

const BREAD_RECIPE = aRecipeSummary({ yieldQuantity: "10.5", ingredientCount: 2 });

function withCatalog(products: Product[] = [BREAD, CAKE, FLOUR]) {
  server.use(http.get(apiUrl("/products"), () => HttpResponse.json(products)));
}

function withRecipes(summaries: RecipeSummary[] = [BREAD_RECIPE]) {
  server.use(http.get(apiUrl("/recipes"), () => HttpResponse.json(summaries)));
}

const rowOf = async (description: string) => within((await screen.findByText(description)).closest("tr")!);

const consult = () => userEvent.click(screen.getByRole("button", { name: "Consultar" }));

describe("RecipesListPage", () => {
  it("lists each active manufactured product with a summary of its recipe", async () => {
    withCatalog();
    withRecipes();

    renderWithProviders(<RecipesListPage />);

    const bread = await rowOf("Pão francês");
    expect(bread.getByText("Com receita")).toBeInTheDocument();
    expect(bread.getByText("10,5 kg")).toBeInTheDocument();
    expect(bread.getByText("2")).toBeInTheDocument();
    expect(bread.getByText(/^13\/10\/2026/)).toBeInTheDocument();

    const cake = await rowOf("Bolo de fubá");
    expect(cake.getByText("Sem receita")).toBeInTheDocument();
    expect(cake.getByText("un")).toBeInTheDocument();
    expect(cake.getAllByText("—")).toHaveLength(3);
  });

  it("leaves out goods and inactive products, which take no recipe here", async () => {
    withCatalog([BREAD, FLOUR, aProduct({ sku: "sku-3", description: "Broa", kind: "MANUFACTURED", isActive: false })]);
    withRecipes([]);

    renderWithProviders(<RecipesListPage />);

    await screen.findByText("Pão francês");
    expect(screen.queryByText("Farinha de trigo")).not.toBeInTheDocument();
    expect(screen.queryByText("Broa")).not.toBeInTheDocument();
    expect(screen.getByText("1 produto")).toBeInTheDocument();
  });

  it("says there is nothing to write a recipe for when no manufactured product is active", async () => {
    withCatalog([FLOUR]);
    withRecipes([]);

    renderWithProviders(<RecipesListPage />);

    expect(await screen.findByText("Nenhum produto fabricado ativo cadastrado.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each(["/products", "/recipes"])("offers a way out when %s fails to load", async (failing) => {
    withCatalog();
    withRecipes();
    let attempts = 0;
    server.use(
      http.get(apiUrl(failing), () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 502 })
          : HttpResponse.json(failing === "/products" ? [BREAD] : [BREAD_RECIPE]);
      }),
    );

    renderWithProviders(<RecipesListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Pão francês")).toBeInTheDocument();
  });

  it("searches by description only when Consultar is pressed", async () => {
    withCatalog();
    withRecipes();

    renderWithProviders(<RecipesListPage />);
    await screen.findByText("Pão francês");
    await userEvent.type(screen.getByLabelText("Buscar produtos"), "bolo");

    expect(screen.getByText("Pão francês")).toBeInTheDocument();

    await consult();

    await waitFor(() => expect(screen.queryByText("Pão francês")).not.toBeInTheDocument());
    expect(screen.getByText("Bolo de fubá")).toBeInTheDocument();
  });

  it("narrows the list to the products with or without a recipe", async () => {
    withCatalog();
    withRecipes();

    renderWithProviders(<RecipesListPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Receita: Todas" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Sem receita" }));
    await consult();

    await waitFor(() => expect(screen.queryByText("Pão francês")).not.toBeInTheDocument());
    expect(screen.getByText("Bolo de fubá")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Receita: Sem receita" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Com receita" }));
    await consult();

    await waitFor(() => expect(screen.queryByText("Bolo de fubá")).not.toBeInTheDocument());
    expect(screen.getByText("Pão francês")).toBeInTheDocument();
  });

  it("says when nothing matches the filters, and clears them back to every product", async () => {
    withCatalog();
    withRecipes();

    renderWithProviders(<RecipesListPage />, { route: "/recipes?q=nada" });

    expect(await screen.findByText("Nenhum produto encontrado para estes filtros.")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]!);

    expect(await screen.findByText("Pão francês")).toBeInTheDocument();
    expect(screen.getByText("Bolo de fubá")).toBeInTheDocument();
  });

  it("opens the recipe to read from the name of its product", async () => {
    withCatalog();
    withRecipes();
    server.use(http.get(apiUrl(`/products/${BREAD.sku}/recipe`), () => HttpResponse.json(aRecipe())));

    renderWithProviders(<RecipesListPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pão francês" }));

    expect(await screen.findByRole("heading", { name: "Receita de Pão francês" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar receita" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("opens the recipe straight into its form from the actions of the row", async () => {
    withCatalog();
    withRecipes();
    server.use(http.get(apiUrl(`/products/${BREAD.sku}/recipe`), () => HttpResponse.json(aRecipe())));

    renderWithProviders(<RecipesListPage />);
    await chooseRowAction("Ações de Pão francês", "Editar receita");

    expect(await screen.findByLabelText("Rendimento (kg)")).toHaveValue("10");
  });

  it("offers to create the recipe a product does not have, and lists it once saved", async () => {
    withCatalog();
    withRecipes([]);
    server.use(
      http.get(apiUrl(`/products/${BREAD.sku}/recipe`), () =>
        HttpResponse.json({ message: "Recipe not found." }, { status: 404 }),
      ),
      http.put(apiUrl(`/products/${BREAD.sku}/recipe`), () => {
        withRecipes([BREAD_RECIPE]);
        return HttpResponse.json(aRecipe());
      }),
    );

    renderWithProviders(<RecipesListPage />);
    await chooseRowAction("Ações de Pão francês", "Criar receita");
    await userEvent.type(await screen.findByLabelText("Rendimento (kg)"), "10");
    await userEvent.selectOptions(screen.getByLabelText("Ingrediente 1"), "Farinha de trigo (kg)");
    await userEvent.type(screen.getByLabelText("Quantidade do ingrediente 1"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Salvar receita" }));

    await screen.findByRole("button", { name: "Editar receita" });
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(await (await rowOf("Pão francês")).findByText("Com receita")).toBeInTheDocument();
  });

  it("registers a missing ingredient over the recipe, and puts it on the row without losing what was typed", async () => {
    const YEAST = aProduct({ sku: "018f0000-0000-7000-8000-000000000022", description: "Fermento", unit: "GRAM" });
    withCatalog();
    withRecipes([]);
    server.use(
      http.get(apiUrl(`/products/${BREAD.sku}/recipe`), () =>
        HttpResponse.json({ message: "Recipe not found." }, { status: 404 }),
      ),
      http.post(apiUrl("/products"), () => {
        withCatalog([BREAD, CAKE, FLOUR, YEAST]);
        return HttpResponse.json(YEAST, { status: 201 });
      }),
    );

    renderWithProviders(<RecipesListPage />);
    await chooseRowAction("Ações de Pão francês", "Criar receita");
    await userEvent.type(await screen.findByLabelText("Rendimento (kg)"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar ingrediente na linha 1" }));

    const product = within(await screen.findByRole("dialog", { name: "Novo produto" }));
    await userEvent.type(product.getByLabelText("Descrição"), "Fermento");
    await userEvent.selectOptions(product.getByLabelText("Tipo"), "Mercadoria");
    await userEvent.selectOptions(product.getByLabelText("Unidade"), "Grama (g)");
    await userEvent.click(product.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Novo produto" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Ingrediente 1")).toHaveValue(YEAST.sku);
    expect(screen.getByTestId("ingredient-unit-1")).toHaveTextContent("g");
    expect(screen.getByLabelText("Rendimento (kg)")).toHaveValue("10");
  });

  it("goes back to the recipe as it was when registering the ingredient is given up", async () => {
    withCatalog();
    withRecipes([]);
    server.use(
      http.get(apiUrl(`/products/${BREAD.sku}/recipe`), () =>
        HttpResponse.json({ message: "Recipe not found." }, { status: 404 }),
      ),
    );

    renderWithProviders(<RecipesListPage />);
    await chooseRowAction("Ações de Pão francês", "Criar receita");
    await userEvent.type(await screen.findByLabelText("Rendimento (kg)"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar ingrediente na linha 1" }));
    const product = within(await screen.findByRole("dialog", { name: "Novo produto" }));
    await userEvent.click(product.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Novo produto" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Rendimento (kg)")).toHaveValue("10");
    expect(screen.getByLabelText("Ingrediente 1")).toHaveValue("");
  });

  it("starts a new recipe from the + button, choosing among the products without one", async () => {
    withCatalog();
    withRecipes();
    server.use(
      http.get(apiUrl(`/products/${CAKE.sku}/recipe`), () =>
        HttpResponse.json({ message: "Recipe not found." }, { status: 404 }),
      ),
    );

    renderWithProviders(<RecipesListPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nova receita" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Nova receita" }));
    const choice = dialog.getByLabelText("Produto");
    expect(within(choice).queryByRole("option", { name: "Pão francês" })).not.toBeInTheDocument();
    expect(within(choice).queryByRole("option", { name: "Farinha de trigo" })).not.toBeInTheDocument();

    await userEvent.selectOptions(choice, "Bolo de fubá");
    await userEvent.click(dialog.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Nova receita de Bolo de fubá" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Rendimento (un)")).toHaveValue("");
  });

  it("asks for the product before going on to the recipe", async () => {
    withCatalog();
    withRecipes();

    renderWithProviders(<RecipesListPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nova receita" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nova receita" }));
    await userEvent.click(dialog.getByRole("button", { name: "Continuar" }));

    expect(dialog.getByText("Escolha o produto.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Nova receita de/ })).not.toBeInTheDocument();
  });

  it("says so when every product already has a recipe", async () => {
    withCatalog([BREAD, FLOUR]);
    withRecipes();

    renderWithProviders(<RecipesListPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nova receita" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Nova receita" }));
    expect(dialog.getByText("Todos os produtos fabricados ativos já têm receita.")).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
  });
});
