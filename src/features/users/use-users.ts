import { useQuery } from "@tanstack/react-query";
import { fetchUsers, type User } from "@/features/users/users.api";

export const USERS_QUERY_KEY = ["users"] as const;

export function useUsers() {
  return useQuery<User[]>({ queryKey: USERS_QUERY_KEY, queryFn: fetchUsers });
}
