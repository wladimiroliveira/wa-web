import { useMutation } from "@tanstack/react-query";
import { createStockEntry, type CreateStockEntryInput, type StockEntryResult } from "@/features/stock/stock.api";
import { useInvalidateSupplies } from "@/features/supplies/use-supply-mutations";

/**
 * `supplyId` travels with the variables rather than with the hook: the dialog
 * is opened for a different supply on every row of the list.
 *
 * One invalidation is enough. `["supplies"]` is a prefix of the ledger key, so
 * it refreshes the balances and that supply's movements in one call.
 */
export function useCreateStockEntry() {
  const invalidate = useInvalidateSupplies();

  return useMutation<StockEntryResult, unknown, { supplyId: string } & CreateStockEntryInput>({
    mutationFn: ({ supplyId, ...input }) => createStockEntry(supplyId, input),
    onSuccess: invalidate,
  });
}
