import { useQuery } from "@tanstack/react-query";
import { fetchRoles, type Role } from "@/features/roles/roles.api";

export const ROLES_QUERY_KEY = ["roles"] as const;

export function useRoles() {
  return useQuery<Role[]>({ queryKey: ROLES_QUERY_KEY, queryFn: fetchRoles });
}
