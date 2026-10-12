import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SuppliersListPage } from "@/features/suppliers/SuppliersListPage";
import type { Permission } from "@/lib/api";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aSupplier } from "@/tests/samples";

function signedIn(permissions: Permission[] = ["CATALOG_READ", "CATALOG_CREATE"]) {
  setRefreshToken("refresh-one");
  server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions }))));
}

describe("SuppliersListPage", () => {
  it("lists the suppliers", async () => {
    signedIn();
    server.use(http.get(apiUrl("/suppliers"), () => HttpResponse.json([aSupplier({ name: "Moinho Santa Clara" })])));

    renderWithProviders(<SuppliersListPage />);

    expect(await screen.findByRole("cell", { name: "Moinho Santa Clara" })).toBeInTheDocument();
  });

  it("says there are no suppliers instead of showing a bare table", async () => {
    signedIn();
    server.use(http.get(apiUrl("/suppliers"), () => HttpResponse.json([])));

    renderWithProviders(<SuppliersListPage />);

    expect(await screen.findByText("Nenhum fornecedor cadastrado ainda.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    signedIn();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/suppliers"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([aSupplier()]);
      }),
    );

    renderWithProviders(<SuppliersListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("cell", { name: "Moinho Santa Clara" })).toBeInTheDocument();
  });

  it("hides the registration from whoever may only read the catalog", async () => {
    signedIn(["CATALOG_READ"]);
    server.use(http.get(apiUrl("/suppliers"), () => HttpResponse.json([aSupplier()])));

    renderWithProviders(<SuppliersListPage />);

    await screen.findByRole("cell", { name: "Moinho Santa Clara" });
    expect(screen.queryByRole("button", { name: "Novo fornecedor" })).not.toBeInTheDocument();
  });

  it("shows the registered supplier in the list without a manual reload", async () => {
    signedIn();
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/suppliers"), () => {
        listCalls += 1;
        return HttpResponse.json(listCalls === 1 ? [] : [aSupplier({ name: "Laticínio Boa Vista" })]);
      }),
      http.post(apiUrl("/suppliers"), () => HttpResponse.json(aSupplier(), { status: 201 })),
    );

    renderWithProviders(<SuppliersListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Novo fornecedor" }));
    await userEvent.type(await screen.findByLabelText("Nome"), "Laticínio Boa Vista");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("cell", { name: "Laticínio Boa Vista" })).toBeInTheDocument();
    expect(listCalls).toBe(2);
  });
});
