import { QueryClient } from "@tanstack/react-query";

/**
 * `retry: false` because the HTTP layer already handles the one retry that
 * matters — the replay after a token refresh. Anything beyond that just delays
 * an error the user needs to see.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
