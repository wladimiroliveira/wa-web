import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type Supply = paths["/supplies"]["get"]["responses"][200]["content"]["application/json"][number];
export type CreateSupplyInput = paths["/supplies"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateSupplyInput = paths["/supplies/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function fetchSupplies(): Promise<Supply[]> {
  return request<Supply[]>("/supplies");
}

export function fetchSupply(id: string): Promise<Supply> {
  return request<Supply>(`/supplies/${id}`);
}

export function createSupply(input: CreateSupplyInput): Promise<Supply> {
  return request<Supply>("/supplies", { method: "POST", body: JSON.stringify(input) });
}

export function updateSupply(id: string, input: UpdateSupplyInput): Promise<Supply> {
  return request<Supply>(`/supplies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteSupply(id: string): Promise<void> {
  return request<void>(`/supplies/${id}`, { method: "DELETE" });
}
