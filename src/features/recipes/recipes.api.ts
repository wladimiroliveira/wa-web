import type { Recipe, RecipeSummary, SaveRecipeBody } from "@/lib/api";
import { ApiError, request } from "@/lib/http";

export const recipesKeys = {
  all: ["recipes"] as const,
  detail: (productSku: string) => [...recipesKeys.all, "detail", productSku] as const,
  list: ["recipes", "list"] as const,
};

/** One line per recipe there is: a product missing from it has none. */
export function fetchRecipeSummaries(): Promise<RecipeSummary[]> {
  return request<RecipeSummary[]>("/recipes");
}

/** A product with no recipe yet is an answer, not a failure: the API says 404 and this says `null`. */
export async function fetchRecipe(productSku: string): Promise<Recipe | null> {
  try {
    return await request<Recipe>(`/products/${productSku}/recipe`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function saveRecipe(productSku: string, body: SaveRecipeBody): Promise<Recipe> {
  return request<Recipe>(`/products/${productSku}/recipe`, { method: "PUT", body: JSON.stringify(body) });
}
