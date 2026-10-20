import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { fetchRecipe, fetchRecipeSummaries, recipesKeys, saveRecipe } from "@/features/recipes/recipes.api";
import { ApiError } from "@/lib/http";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aRecipe, aRecipeSummary } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("recipes api", () => {
  it("names the recipe of each product apart, all under the feature's own", () => {
    expect(recipesKeys.all).toEqual(["recipes"]);
    expect(recipesKeys.detail("sku-1")).toEqual(["recipes", "detail", "sku-1"]);
    expect(recipesKeys.list).toEqual(["recipes", "list"]);
  });

  it("reads a summary of every recipe", async () => {
    server.use(http.get(apiUrl("/recipes"), () => HttpResponse.json([aRecipeSummary()])));

    await expect(fetchRecipeSummaries()).resolves.toEqual([aRecipeSummary()]);
  });

  it("reads the recipe of a product", async () => {
    server.use(http.get(apiUrl("/products/sku-1/recipe"), () => HttpResponse.json(aRecipe())));

    await expect(fetchRecipe("sku-1")).resolves.toEqual(aRecipe());
  });

  it("answers with nothing for a product that has no recipe yet", async () => {
    server.use(
      http.get(apiUrl("/products/sku-1/recipe"), () =>
        HttpResponse.json({ message: "Recipe not found." }, { status: 404 }),
      ),
    );

    await expect(fetchRecipe("sku-1")).resolves.toBeNull();
  });

  it("fails when the recipe cannot be read", async () => {
    server.use(http.get(apiUrl("/products/sku-1/recipe"), () => new HttpResponse(null, { status: 502 })));

    await expect(fetchRecipe("sku-1")).rejects.toBeInstanceOf(ApiError);
  });

  it("defines the recipe of a product from its yield and ingredients", async () => {
    const body = { yieldQuantity: "10", ingredients: [{ productSku: "sku-2", quantity: "6" }] };
    let received: unknown = null;
    server.use(
      http.put(apiUrl("/products/sku-1/recipe"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRecipe());
      }),
    );

    await expect(saveRecipe("sku-1", body)).resolves.toEqual(aRecipe());
    expect(received).toEqual(body);
  });
});
