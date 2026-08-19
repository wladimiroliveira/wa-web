import { useQuery } from "@tanstack/react-query";
import { fetchRecipePricing, type RecipePricing } from "@/features/recipes/recipes.api";
import { RECIPES_QUERY_KEY } from "@/features/recipes/use-recipes";

export function recipePricingQueryKey(id: string) {
  return [...RECIPES_QUERY_KEY, id, "pricing"] as const;
}

/**
 * No `retry` option: `createQueryClient` already defaults every query to
 * `retry: false`, which is what this one needs — the failure that matters here
 * is the 409 the API sends when a supply drifted to another dimension, and
 * retrying it only delays the message that says how to fix it.
 */
export function useRecipePricing(id: string | undefined) {
  return useQuery<RecipePricing>({
    queryKey: recipePricingQueryKey(id ?? ""),
    queryFn: () => fetchRecipePricing(id!),
    enabled: Boolean(id),
  });
}
