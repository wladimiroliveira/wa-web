import { useQuery } from "@tanstack/react-query";
import { fetchRecipe, type RecipeDetail } from "@/features/recipes/recipes.api";
import { RECIPES_QUERY_KEY } from "@/features/recipes/use-recipes";

export function recipeQueryKey(id: string) {
  return [...RECIPES_QUERY_KEY, id] as const;
}

export function useRecipe(id: string | undefined) {
  return useQuery<RecipeDetail>({
    queryKey: recipeQueryKey(id ?? ""),
    queryFn: () => fetchRecipe(id!),
    enabled: Boolean(id),
  });
}
