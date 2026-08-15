import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSession, type Credentials } from "@/features/auth/auth.api";
import { SESSION_QUERY_KEY } from "@/features/auth/use-session";
import type { Me } from "@/features/auth/permission";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<Me, unknown, Credentials>({
    mutationFn: createSession,
    // Seed the session query with what login already fetched, so the guard
    // renders without a second round trip to /me.
    onSuccess: (me) => queryClient.setQueryData(SESSION_QUERY_KEY, me),
  });
}
