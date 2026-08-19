import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipePricing,
  fetchRecipes,
  updateRecipe,
} from "@/features/recipes/recipes.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const RECIPE_ID = "44444444-4444-4444-8444-444444444444";
const SUPPLY_ID = "33333333-3333-4333-8333-333333333333";

const recipe = {
  id: RECIPE_ID,
  name: "Coxinha",
  batchYield: 100,
  laborCostPerHundred: 12,
  margin: 0.35,
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("recipes.api", () => {
  test("fetchRecipes returns the list", async () => {
    server.use(msw.get(`${API}/recipes`, () => HttpResponse.json([recipe])));

    await expect(fetchRecipes()).resolves.toEqual([recipe]);
  });

  test("fetchRecipe returns the recipe with its items", async () => {
    const detail = {
      ...recipe,
      items: [{ id: "item-1", recipeId: RECIPE_ID, supplyId: SUPPLY_ID, usageQty: 5, usageUnit: "KG" }],
    };
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}`, () => HttpResponse.json(detail)));

    await expect(fetchRecipe(RECIPE_ID)).resolves.toEqual(detail);
  });

  test("fetchRecipePricing asks the pricing route", async () => {
    const pricing = {
      suppliesCostPerHundred: 38.4,
      totalCostPerHundred: 50.4,
      exactPrice: 68.04,
      pricePerHundred: 69,
      pricePerHalfHundred: 35,
    };
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () => HttpResponse.json(pricing)));

    await expect(fetchRecipePricing(RECIPE_ID)).resolves.toEqual(pricing);
  });

  test("createRecipe posts the header and the items in one body", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/recipes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...recipe, items: [] }, { status: 201 });
      }),
    );

    await createRecipe({
      name: "Coxinha",
      batchYield: 100,
      laborCostPerHundred: 12,
      margin: 0.35,
      items: [{ supplyId: SUPPLY_ID, usageQty: 5, usageUnit: "KG" }],
    });

    expect(body).toEqual({
      name: "Coxinha",
      batchYield: 100,
      laborCostPerHundred: 12,
      margin: 0.35,
      items: [{ supplyId: SUPPLY_ID, usageQty: 5, usageUnit: "KG" }],
    });
  });

  test("updateRecipe patches by id", async () => {
    let body: unknown;
    server.use(
      msw.patch(`${API}/recipes/${RECIPE_ID}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...recipe, items: [] });
      }),
    );

    await updateRecipe(RECIPE_ID, { name: "Coxinha grande" });

    expect(body).toEqual({ name: "Coxinha grande" });
  });

  test("deleteRecipe deletes by id", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/recipes/${RECIPE_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteRecipe(RECIPE_ID);

    expect(deleted).toBe(true);
  });
});
