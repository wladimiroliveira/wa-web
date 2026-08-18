import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { SuppliesListPage } from "@/features/supplies/SuppliesListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const supply = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

function renderList(permissions: string[], supplies: unknown[] = [supply]) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions,
      }),
    ),
    msw.get(`${API}/supplies`, () => HttpResponse.json(supplies)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/supplies" element={<SuppliesListPage />} />
      </Routes>
    </>,
    { route: "/supplies" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("SuppliesListPage", () => {
  test("shows the name, the type, what is bought and the price", async () => {
    renderList(["SUPPLIES_READ", "SUPPLIES_WRITE"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;

    expect(row).toHaveTextContent("Ingrediente");
    expect(row).toHaveTextContent("5 kg");
    expect(row).toHaveTextContent("R$ 24,00");
  });

  test("deleting asks first and only calls the API after confirmation", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/supplies/${supply.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderList(["SUPPLIES_READ", "SUPPLIES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    expect(deleted).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir insumo$/i }));

    expect(deleted).toBe(true);
  });

  // The API answers any FK violation with "Operação viola uma referência
  // existente", which does not tell the person what to do. The screen names the
  // only two references the schema allows.
  test("a 409 on deletion explains that the supply already moved or is in a recipe", async () => {
    server.use(
      msw.delete(`${API}/supplies/${supply.id}`, () =>
        HttpResponse.json({ message: "Operação viola uma referência existente" }, { status: 409 }),
      ),
    );
    renderList(["SUPPLIES_READ", "SUPPLIES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^excluir insumo$/i }));

    expect(await screen.findByText(/movimentação de estoque ou que faz parte de uma receita/i)).toBeInTheDocument();
    expect(screen.getByText("Farinha de trigo")).toBeInTheDocument();
  });

  test("hides the write actions from a read-only reader", async () => {
    renderList(["SUPPLIES_READ"]);

    expect(await screen.findByText("Farinha de trigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /novo insumo/i })).not.toBeInTheDocument();
  });

  test("says so when there is nothing registered", async () => {
    renderList(["SUPPLIES_READ"], []);

    expect(await screen.findByText(/nenhum insumo cadastrado/i)).toBeInTheDocument();
  });
});
