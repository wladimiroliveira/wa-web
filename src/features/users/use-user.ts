import { useQuery } from "@tanstack/react-query";
import type { Permission } from "@/features/auth/permission";
import { fetchUser, fetchUserPermissions, type User } from "@/features/users/users.api";

export function userQueryKey(id: string) {
  return ["users", id] as const;
}

export function userPermissionsQueryKey(id: string) {
  return ["users", id, "permissions"] as const;
}

export function useUser(id: string | undefined) {
  return useQuery<User>({ queryKey: userQueryKey(id ?? ""), queryFn: () => fetchUser(id!), enabled: Boolean(id) });
}

export function useUserPermissions(id: string | undefined) {
  return useQuery<Permission[]>({
    queryKey: userPermissionsQueryKey(id ?? ""),
    queryFn: () => fetchUserPermissions(id!),
    enabled: Boolean(id),
  });
}
