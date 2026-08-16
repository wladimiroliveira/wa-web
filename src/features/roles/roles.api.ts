import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type Role = paths["/roles"]["get"]["responses"][200]["content"]["application/json"][number];
export type CreateRoleInput = paths["/roles"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateRoleInput = paths["/roles/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function fetchRoles(): Promise<Role[]> {
  return request<Role[]>("/roles");
}

export function createRole(input: CreateRoleInput): Promise<Role> {
  return request<Role>("/roles", { method: "POST", body: JSON.stringify(input) });
}

export function updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
  return request<Role>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRole(id: string): Promise<void> {
  return request<void>(`/roles/${id}`, { method: "DELETE" });
}
