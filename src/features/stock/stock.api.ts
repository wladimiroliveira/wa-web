import type { StockPosition } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for this feature's cache entry. Whatever moves the stock invalidates it. */
export const stockKeys = {
  all: ["stock"] as const,
};

export function fetchStockPosition(): Promise<StockPosition> {
  return request<StockPosition>("/stock");
}
