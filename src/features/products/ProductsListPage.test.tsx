import { HttpResponse, http } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProductsListPage } from "@/features/products/ProductsListPage";
import type { Permission } from "@/lib/api";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aProduct } from "@/tests/samples";

function signedIn(permissions: Permission[] = ["CATALOG_READ", "CATALOG_CREATE"]) {
  setRefreshToken("refresh-one");
  server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions }))));
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
});
