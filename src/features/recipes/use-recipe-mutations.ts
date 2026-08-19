import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
  type CreateRecipeInput,
  type RecipeWithItems,
  type UpdateRecipeInput,
} from "@/features/recipes/recipes.api";
import { RECIPES_QUERY_KEY } from "@/features/recipes/use-recipes";

/**
 * Coarse by key hierarchy, as in the earlier slices: `["recipes"]` is a prefix
 * of `["recipes", id]` and of `["recipes", id, "pricing"]`, so one call reaches
 * the list, the detail and the price. The price matters most — changing an item
 * changes what the recipe costs, and a stale price is a wrong number on the one
 * screen that exists to give right ones.
 */
export function useInvalidateRecipes() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
  };
}

export function useCreateRecipe() {
  const invalidate = useInvalidateRecipes();

  return useMutation<RecipeWithItems, unknown, CreateRecipeInput>({
    mutationFn: createRecipe,
    onSuccess: invalidate,
  });
}

export function useUpdateRecipe(id: string) {
  const invalidate = useInvalidateRecipes();

  return useMutation<RecipeWithItems, unknown, UpdateRecipeInput>({
    mutationFn: (input) => updateRecipe(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecipe() {
  const invalidate = useInvalidateRecipes();

  return useMutation<void, unknown, string>({ mutationFn: deleteRecipe, onSuccess: invalidate });
}
