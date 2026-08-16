import type { Permission } from "@/features/auth/permission";
import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type User = paths["/users/{id}"]["get"]["responses"][200]["content"]["application/json"];
export type CreateUserInput = paths["/users"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateUserInput = paths["/users/{id}"]["patch"]["requestBody"]["content"]["application/json"];

type UserPermissionsResponse = paths["/users/{id}/permissions"]["get"]["responses"][200]["content"]["application/json"];

export function fetchUsers(): Promise<User[]> {
  return request<User[]>("/users");
}

export function fetchUser(id: string): Promise<User> {
  return request<User>(`/users/${id}`);
}

/**
 * The effective set, computed by the API. The form opens from this instead of
 * a client-side sum, so the front end never re-implements the precedence rule.
 */
export async function fetchUserPermissions(id: string): Promise<Permission[]> {
  const response = await request<UserPermissionsResponse>(`/users/${id}/permissions`);
  return response.permissions;
}

export function createUser(input: CreateUserInput): Promise<User> {
  return request<User>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
