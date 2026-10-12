import type { CreateSupplierBody, Supplier } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for the suppliers' cache entry, shared by every screen that picks one. */
export const suppliersKeys = {
  all: ["suppliers"] as const,
};

export function fetchSuppliers(): Promise<Supplier[]> {
  return request<Supplier[]>("/suppliers");
}

export function createSupplier(body: CreateSupplierBody): Promise<Supplier> {
  return request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(body) });
}
