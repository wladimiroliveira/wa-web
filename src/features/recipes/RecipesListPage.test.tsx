import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { RecipesListPage } from "@/features/recipes/RecipesListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const RECIPE_ID = "44444444-4444-4444-8444-444444444444";

const recipe = {
  id: RECIPE_ID,
  name: "Coxinha",
  batchYield: 100,
  laborCostPerHundred: 12,
  margin: 0.35,
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
};

function renderList(permissions: string[], recipes: unknown[] = [recipe]) {
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
    msw.get(`${API}/recipes`, () => HttpResponse.json(recipes)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/recipes" element={<RecipesListPage />} />
      </Routes>
    </>,
    { route: "/recipes" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RecipesListPage", () => {
  test("shows the yield, the labor cost and the margin as a percentage", async () => {
    renderList(["RECIPES_READ", "RECIPES_WRITE", "PRICING_READ"]);

    const row = (await screen.findByText("Coxinha")).closest("tr")!;

    expect(row).toHaveTextContent("100 un");
    expect(row).toHaveTextContent("R$ 12,00");
    expect(row).toHaveTextContent("35 %");
    expect(within(row).getByRole("link", { name: /preço/i })).toHaveAttribute("href", `/recipes/${RECIPE_ID}/pricing`);
  });

  test("says so when there is nothing registered", async () => {
    renderList(["RECIPES_READ"], []);

    expect(await screen.findByText(/nenhuma receita cadastrada/i)).toBeInTheDocument();
  });

  test("hides the write actions from a read-only reader", async () => {
    renderList(["RECIPES_READ"]);

    expect(await screen.findByText("Coxinha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /nova receita/i })).not.toBeInTheDocument();
  });

  // PRICING_READ is independent of RECIPES_READ in the API's enum: the screen
  // keeps the two apart instead of assuming one implies the other.
  test("hides the price link from whoever cannot read pricing", async () => {
    renderList(["RECIPES_READ", "RECIPES_WRITE"]);

    expect(await screen.findByText("Coxinha")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /preço/i })).not.toBeInTheDocument();
  });

  test("deleting asks first and only calls the API after confirmation", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/recipes/${RECIPE_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderList(["RECIPES_READ", "RECIPES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    expect(deleted).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir receita$/i }));

    expect(deleted).toBe(true);
  });

  // `Production.recipeId` is the only Restrict reference to Recipe in the
  // schema, so the screen can name the cause the API's generic message hides.
  test("a 409 on deletion explains that the recipe already has production", async () => {
    server.use(
      msw.delete(`${API}/recipes/${RECIPE_ID}`, () =>
        HttpResponse.json({ message: "Operação viola uma referência existente" }, { status: 409 }),
      ),
    );
    renderList(["RECIPES_READ", "RECIPES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^excluir receita$/i }));

    expect(await screen.findByText(/já tem produção registrada/i)).toBeInTheDocument();
    expect(screen.getByText("Coxinha")).toBeInTheDocument();
  });
});
