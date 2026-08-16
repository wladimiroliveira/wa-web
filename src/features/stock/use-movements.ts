import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchMovements, type MovementPage } from "@/features/stock/stock.api";

export function movementsQueryKey(supplyId: string) {
  return ["supplies", supplyId, "movements"] as const;
}

/**
 * No infinite scroll: the ledger is something a person reads while checking,
 * and loading without being asked gets in the way. `nextCursor` comes back
 * `null` at the end, which turns the button off.
 */
export function useMovements(supplyId: string | undefined) {
  return useInfiniteQuery({
    queryKey: movementsQueryKey(supplyId ?? ""),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchMovements(supplyId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: MovementPage) => last.nextCursor ?? undefined,
    enabled: Boolean(supplyId),
  });
}
