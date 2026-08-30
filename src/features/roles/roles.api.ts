import type { CreateRoleBody, Role, UpdateRoleBody } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for this feature's cache entry. Every mutation invalidates it. */
export const rolesKeys = {
  all: ["roles"] as const,
};

export function fetchRoles(): Promise<Role[]> {
  return request<Role[]>("/roles");
}

export function createRole(body: CreateRoleBody): Promise<Role> {
  return request<Role>("/roles", { method: "POST", body: JSON.stringify(body) });
}

export function updateRole(id: string, body: UpdateRoleBody): Promise<Role> {
  return request<Role>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteRole(id: string): Promise<void> {
  return request<void>(`/roles/${id}`, { method: "DELETE" });
}
