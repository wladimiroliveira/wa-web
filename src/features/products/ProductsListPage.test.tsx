import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProductsListPage } from "@/features/products/ProductsListPage";
import type { Permission } from "@/lib/api";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aProduct, aRecipe } from "@/tests/samples";

function signedIn(permissions: Permission[] = ["CATALOG_READ", "CATALOG_CREATE"]) {
  setRefreshToken("refresh-one");
  server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions }))));
}

const BREAD = aProduct({
  sku: "018f0000-0000-7000-8000-000000000090",
  description: "Pão francês",
  kind: "MANUFACTURED",
});
const FLOUR = aProduct();

/** Registers `product` through the dialog, with the API answering as if it had just been created. */
async function register(product: typeof BREAD) {
  server.use(
    http.get(apiUrl("/products"), () => HttpResponse.json([FLOUR, product])),
    http.post(apiUrl("/products"), () => HttpResponse.json(product, { status: 201 })),
  );

  renderWithProviders(<ProductsListPage />);

  await userEvent.click(await screen.findByRole("button", { name: "Novo produto" }));
  await userEvent.type(await screen.findByLabelText("Descrição"), product.description);
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), product.kind === "GOODS" ? "Mercadoria" : "Fabricado");
  await userEvent.selectOptions(screen.getByLabelText("Unidade"), "Quilograma (kg)");
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("ProductsListPage", () => {
  it("lists each product with its kind, unit, GTIN and status in Portuguese", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/products"), () =>
        HttpResponse.json([
          aProduct({ sku: "sku-1", description: "Farinha de trigo", gtin: "7891000100103" }),
          aProduct({ sku: "sku-2", description: "Pão", kind: "MANUFACTURED", unit: "UNIT", isActive: false }),
        ]),
      ),
    );

    renderWithProviders(<ProductsListPage />);

    const flour = within((await screen.findByText("Farinha de trigo")).closest("tr")!);
    expect(flour.getByText("Mercadoria")).toBeInTheDocument();
    expect(flour.getByText("kg")).toBeInTheDocument();
    expect(flour.getByText("7891000100103")).toBeInTheDocument();
    expect(flour.getByText("Ativo")).toBeInTheDocument();

    const bread = within(screen.getByText("Pão").closest("tr")!);
    expect(bread.getByText("Fabricado")).toBeInTheDocument();
    expect(bread.getByText("un")).toBeInTheDocument();
    expect(bread.getByText("—")).toBeInTheDocument();
    expect(bread.getByText("Inativo")).toBeInTheDocument();
  });

  it("says the catalog is empty instead of showing a bare table", async () => {
    signedIn();
    server.use(http.get(apiUrl("/products"), () => HttpResponse.json([])));

    renderWithProviders(<ProductsListPage />);

    expect(await screen.findByText("Nenhum produto cadastrado ainda.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    signedIn();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/products"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([aProduct()]);
      }),
    );

    renderWithProviders(<ProductsListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Farinha de trigo")).toBeInTheDocument();
  });

  it("hides the registration from whoever may only read the catalog", async () => {
    signedIn(["CATALOG_READ"]);
    server.use(http.get(apiUrl("/products"), () => HttpResponse.json([aProduct()])));

    renderWithProviders(<ProductsListPage />);

    await screen.findByText("Farinha de trigo");
    expect(screen.queryByRole("button", { name: "Novo produto" })).not.toBeInTheDocument();
  });

  it("shows the registered product in the list without a manual reload", async () => {
    signedIn();
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/products"), () => {
        listCalls += 1;
        return HttpResponse.json(listCalls === 1 ? [] : [aProduct({ description: "Fermento" })]);
      }),
      http.post(apiUrl("/products"), () => HttpResponse.json(aProduct({ description: "Fermento" }), { status: 201 })),
    );

    renderWithProviders(<ProductsListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Novo produto" }));
    await userEvent.type(await screen.findByLabelText("Descrição"), "Fermento");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "Mercadoria");
    await userEvent.selectOptions(screen.getByLabelText("Unidade"), "Quilograma (kg)");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("cell", { name: "Fermento" })).toBeInTheDocument();
    expect(listCalls).toBe(2);
  });

  it("opens the recipe of a manufactured product as soon as it is registered", async () => {
    signedIn(["CATALOG_READ", "CATALOG_CREATE", "CATALOG_UPDATE"]);
    const received: unknown[] = [];
    server.use(
      http.put(apiUrl(`/products/${BREAD.sku}/recipe`), async ({ request: incoming }) => {
        received.push(await incoming.json());
        return HttpResponse.json(aRecipe());
      }),
    );

    await register(BREAD);

    const dialog = within(await screen.findByRole("dialog", { name: "Nova receita de Pão francês" }));
    expect(screen.queryByRole("dialog", { name: "Novo produto" })).not.toBeInTheDocument();

    await userEvent.type(dialog.getByLabelText("Rendimento (kg)"), "10");
    await userEvent.selectOptions(dialog.getByLabelText("Ingrediente 1"), "Farinha de trigo (kg)");
    await userEvent.type(dialog.getByLabelText("Quantidade do ingrediente 1"), "6");
    await userEvent.click(dialog.getByRole("button", { name: "Salvar receita" }));

    await waitFor(() =>
      expect(received).toEqual([{ yieldQuantity: "10", ingredients: [{ productSku: FLOUR.sku, quantity: "6" }] }]),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("lets the recipe of the product just registered be left for later", async () => {
    signedIn(["CATALOG_READ", "CATALOG_CREATE", "CATALOG_UPDATE"]);

    await register(BREAD);

    const dialog = within(await screen.findByRole("dialog", { name: "Nova receita de Pão francês" }));
    await userEvent.click(dialog.getByRole("button", { name: "Deixar para depois" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("asks for no recipe after registering a product that is not manufactured", async () => {
    signedIn(["CATALOG_READ", "CATALOG_CREATE", "CATALOG_UPDATE"]);

    await register(aProduct({ sku: "sku-9", description: "Fermento" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("cell", { name: "Fermento" })).toBeInTheDocument();
  });

  // The recipe is saved with a permission the registration does not need.
  it("asks for no recipe from whoever may not edit the catalog", async () => {
    signedIn(["CATALOG_READ", "CATALOG_CREATE"]);

    await register(BREAD);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("cell", { name: "Pão francês" })).toBeInTheDocument();
  });
});
