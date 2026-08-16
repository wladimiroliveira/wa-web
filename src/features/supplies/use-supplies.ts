import { useQuery } from "@tanstack/react-query";
import { fetchSupplies, type Supply } from "@/features/supplies/supplies.api";

export const SUPPLIES_QUERY_KEY = ["supplies"] as const;

/** Serves both `/supplies` and `/stock`: the same GET, one cache. */
export function useSupplies() {
  return useQuery<Supply[]>({ queryKey: SUPPLIES_QUERY_KEY, queryFn: fetchSupplies });
}
