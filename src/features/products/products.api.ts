import type {
  CreateProductBody,
  MeasurementUnit,
  Product,
  ProductKind,
  ProductStatus,
  UpdateProductBody,
} from "@/lib/api";
import { request } from "@/lib/http";

/** What the catalog can be narrowed by. Nothing set answers the whole catalog, inactive products included. */
export interface ProductFilters {
  /** Part of the description or of the GTIN. */
  q?: string;
  kind?: ProductKind[];
  unit?: MeasurementUnit[];
  status?: ProductStatus;
}

/** The one name for the catalog's cache entry, shared by every screen that picks a product. */
export const productsKeys = {
  all: ["products"] as const,
  list: (filters: ProductFilters) => [...productsKeys.all, filters] as const,
};

/** The whole catalog. It takes no argument so it can be handed to `useQuery` as it is. */
export function fetchProducts(): Promise<Product[]> {
  return searchProducts({});
}

export function searchProducts(filters: ProductFilters): Promise<Product[]> {
  const params = new URLSearchParams();
  const q = filters.q?.trim();

  if (q) params.set("q", q);
  for (const kind of filters.kind ?? []) params.append("kind", kind);
  for (const unit of filters.unit ?? []) params.append("unit", unit);
  if (filters.status !== undefined) params.set("status", filters.status);

  const search = params.toString();

  return request<Product[]>(search === "" ? "/products" : `/products?${search}`);
}

export function createProduct(body: CreateProductBody): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(body) });
}

export function updateProduct(sku: string, body: UpdateProductBody): Promise<Product> {
  return request<Product>(`/products/${sku}`, { method: "PATCH", body: JSON.stringify(body) });
}
