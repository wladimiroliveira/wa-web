import type { Product } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for the catalog's cache entry, shared by every screen that picks a product. */
export const productsKeys = {
  all: ["products"] as const,
};

export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>("/products");
}
