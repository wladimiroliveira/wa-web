import type { CreateProductBody, Product, UpdateProductBody } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for the catalog's cache entry, shared by every screen that picks a product. */
export const productsKeys = {
  all: ["products"] as const,
};

export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>("/products");
}

export function createProduct(body: CreateProductBody): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(body) });
}

export function updateProduct(sku: string, body: UpdateProductBody): Promise<Product> {
  return request<Product>(`/products/${sku}`, { method: "PATCH", body: JSON.stringify(body) });
}
