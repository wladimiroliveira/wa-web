import { screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { RecipePricingPage } from "@/features/recipes/RecipePricingPage";
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
  items: [],
};

const pricing = {
  suppliesCostPerHundred: 38.4,
  totalCostPerHundred: 50.4,
  exactPrice: 68.04,
  pricePerHundred: 69,
  pricePerHalfHundred: 35,
};

function renderPricing() {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["RECIPES_READ", "RECIPES_WRITE", "PRICING_READ"],
      }),
    ),
    msw.get(`${API}/recipes/${RECIPE_ID}`, () => HttpResponse.json(recipe)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/recipes/:id/pricing" element={<RecipePricingPage />} />
      <Route path="/recipes/:id" element={<p>editar receita</p>} />
      <Route path="/recipes" element={<p>lista de receitas</p>} />
    </Routes>,
    { route: `/recipes/${RECIPE_ID}/pricing` },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RecipePricingPage", () => {
  test("shows the cost breakdown, the hundred and the half hundred", async () => {
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () => HttpResponse.json(pricing)));
    renderPricing();

    expect(await screen.findByText("R$ 38,40")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,40")).toBeInTheDocument();
    expect(screen.getByText("R$ 68,04")).toBeInTheDocument();
    expect(screen.getByText("R$ 69,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 35,00")).toBeInTheDocument();
  });

  // Labor and margin come from the recipe, not from the pricing response.
  test("shows the labor cost and the margin taken from the recipe", async () => {
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () => HttpResponse.json(pricing)));
    renderPricing();

    expect(await screen.findByText("R$ 12,00")).toBeInTheDocument();
    expect(screen.getByText("35 %")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coxinha" })).toBeInTheDocument();
  });

  // The form makes this impossible to create, not impossible to happen: editing
  // the supply afterwards, from KG to L, rots a recipe that was saved valid.
  test("a 409 explains the dimension drift and links to the edit screen", async () => {
    server.use(
      msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () =>
        HttpResponse.json({ code: "DIMENSION_MISMATCH", message: "Dimensões incompatíveis" }, { status: 409 }),
      ),
    );
    renderPricing();

    expect(await screen.findByText(/unidade de outra dimensão/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /editar a receita/i })).toHaveAttribute("href", `/recipes/${RECIPE_ID}`);
  });

  test("a 404 says the recipe was not found and links back to the list", async () => {
    server.use(
      msw.get(`${API}/recipes/${RECIPE_ID}`, () =>
        HttpResponse.json({ message: "Receita não encontrada" }, { status: 404 }),
      ),
      msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () =>
        HttpResponse.json({ message: "Receita não encontrada" }, { status: 404 }),
      ),
    );
    renderPricing();

    expect(await screen.findByText(/receita não encontrada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para receitas/i })).toBeInTheDocument();
  });
});
