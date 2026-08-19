import { useQuery } from "@tanstack/react-query";
import { fetchRecipe, type RecipeDetail } from "@/features/recipes/recipes.api";

export function recipeQueryKey(id: string) {
  return ["recipes", id] as const;
}

export function useRecipe(id: string | undefined) {
  return useQuery<RecipeDetail>({
    queryKey: recipeQueryKey(id ?? ""),
    queryFn: () => fetchRecipe(id!),
    enabled: Boolean(id),
  });
}
