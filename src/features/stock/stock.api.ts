import type { ProductStock, StockPosition } from "@/lib/api";
import { request } from "@/lib/http";

/** Everything lives under `all`, so whatever moves the stock invalidates the list and every product in one call. */
export const stockKeys = {
  all: ["stock"] as const,
  product: (sku: string, depleted: boolean) => [...stockKeys.all, sku, { depleted }] as const,
};

export function fetchStockPosition(): Promise<StockPosition> {
  return request<StockPosition>("/stock");
}

export function fetchProductStock(sku: string, depleted: boolean): Promise<ProductStock> {
  return request<ProductStock>(depleted ? `/stock/${sku}?depleted=true` : `/stock/${sku}`);
}
