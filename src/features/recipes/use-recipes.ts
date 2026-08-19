import { useQuery } from "@tanstack/react-query";
import { fetchRecipes, type Recipe } from "@/features/recipes/recipes.api";

export const RECIPES_QUERY_KEY = ["recipes"] as const;

export function useRecipes() {
  return useQuery<Recipe[]>({ queryKey: RECIPES_QUERY_KEY, queryFn: fetchRecipes });
}
