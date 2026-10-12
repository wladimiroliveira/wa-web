import type { StockMovementPage } from "@/lib/api";
import { request } from "@/lib/http";

/** Every list lives under `all`, so whatever moves the stock invalidates them in one call. */
export const stockMovementsKeys = {
  all: ["stock-movements"] as const,
  list: (productSku: string | undefined) => [...stockMovementsKeys.all, { productSku }] as const,
};

export function fetchStockMovements(query: { productSku?: string; cursor?: string }): Promise<StockMovementPage> {
  const params = new URLSearchParams();

  if (query.productSku !== undefined) params.set("productSku", query.productSku);
  if (query.cursor !== undefined) params.set("cursor", query.cursor);

  const search = params.toString();

  return request<StockMovementPage>(search === "" ? "/stock-movements" : `/stock-movements?${search}`);
}
