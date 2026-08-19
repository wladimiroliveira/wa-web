import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type Recipe = paths["/recipes"]["get"]["responses"][200]["content"]["application/json"][number];

/** `GET /recipes/:id` nests the whole supply inside each item; POST and PATCH do not. */
export type RecipeDetail = paths["/recipes/{id}"]["get"]["responses"][200]["content"]["application/json"];
export type RecipeDetailItem = RecipeDetail["items"][number];
export type RecipeWithItems = paths["/recipes"]["post"]["responses"][201]["content"]["application/json"];

export type RecipePricing = paths["/recipes/{id}/pricing"]["get"]["responses"][200]["content"]["application/json"];

export type CreateRecipeInput = paths["/recipes"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateRecipeInput = paths["/recipes/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function fetchRecipes(): Promise<Recipe[]> {
  return request<Recipe[]>("/recipes");
}

export function fetchRecipe(id: string): Promise<RecipeDetail> {
  return request<RecipeDetail>(`/recipes/${id}`);
}

export function fetchRecipePricing(id: string): Promise<RecipePricing> {
  return request<RecipePricing>(`/recipes/${id}/pricing`);
}

export function createRecipe(input: CreateRecipeInput): Promise<RecipeWithItems> {
  return request<RecipeWithItems>("/recipes", { method: "POST", body: JSON.stringify(input) });
}

export function updateRecipe(id: string, input: UpdateRecipeInput): Promise<RecipeWithItems> {
  return request<RecipeWithItems>(`/recipes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRecipe(id: string): Promise<void> {
  return request<void>(`/recipes/${id}`, { method: "DELETE" });
}
