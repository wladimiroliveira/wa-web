import { useQuery } from "@tanstack/react-query";
import { fetchSupply, type Supply } from "@/features/supplies/supplies.api";

export function supplyQueryKey(id: string) {
  return ["supplies", id] as const;
}

export function useSupply(id: string | undefined) {
  return useQuery<Supply>({
    queryKey: supplyQueryKey(id ?? ""),
    queryFn: () => fetchSupply(id!),
    enabled: Boolean(id),
  });
}
