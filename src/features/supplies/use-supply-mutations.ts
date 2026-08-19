import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSupply,
  deleteSupply,
  updateSupply,
  type CreateSupplyInput,
  type Supply,
  type UpdateSupplyInput,
} from "@/features/supplies/supplies.api";
import { RECIPES_QUERY_KEY } from "@/features/recipes/use-recipes";
import { SUPPLIES_QUERY_KEY } from "@/features/supplies/use-supplies";

/**
 * Coarse by key hierarchy: `["supplies"]` is a prefix of `["supplies", id]` and
 * of the ledger key, so one call reaches the list, the detail and the movements
 * of every supply. Nothing here touches `["me"]` — no screen in this slice
 * changes the permissions of whoever is logged in.
 *
 * `["recipes"]` is not under that prefix and is invalidated on purpose: editing
 * a supply's purchase price changes the price of every recipe that uses it, and
 * there is no way to know which ones without fetching all of them.
 */
export function useInvalidateSupplies() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: SUPPLIES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
  };
}

export function useCreateSupply() {
  const invalidate = useInvalidateSupplies();

  return useMutation<Supply, unknown, CreateSupplyInput>({ mutationFn: createSupply, onSuccess: invalidate });
}

export function useUpdateSupply(id: string) {
  const invalidate = useInvalidateSupplies();

  return useMutation<Supply, unknown, UpdateSupplyInput>({
    mutationFn: (input) => updateSupply(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSupply() {
  const invalidate = useInvalidateSupplies();

  return useMutation<void, unknown, string>({ mutationFn: deleteSupply, onSuccess: invalidate });
}
