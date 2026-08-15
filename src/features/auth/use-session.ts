import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/features/auth/auth.api";
import type { Me } from "@/features/auth/permission";
import { getRefreshToken } from "@/lib/tokens";

export const SESSION_QUERY_KEY = ["me"] as const;

/**
 * The session. There is no second copy of this state anywhere: if this query
 * resolves, the user is logged in, and its data carries the effective
 * permissions the API already computed.
 */
export function useSession() {
  return useQuery<Me>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchMe,
    // With no refresh token stored there is no session to recover: skip the call.
    enabled: getRefreshToken() !== null,
    staleTime: Infinity,
  });
}
