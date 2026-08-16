import { QueryCache, QueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/features/auth/use-session";
import { SessionExpiredError } from "@/lib/http";
import { clearSession } from "@/lib/tokens";

/**
 * `retry: false` because the HTTP layer already handles the one retry that
 * matters — the replay after a token refresh. Anything beyond that just delays
 * an error the user needs to see.
 *
 * The cache-level `onError` is what makes a dead session end everywhere. Any
 * query can be the one that discovers the session is gone, and the guard only
 * watches `/me`: without this, a data screen would clear the tokens while the
 * shell above it kept rendering as if the user were still logged in.
 */
export function createQueryClient(): QueryClient {
  const queryCache = new QueryCache({
    onError: (error) => {
      if (!(error instanceof SessionExpiredError)) return;
      clearSession();
      // Resetting the session query is what re-renders the guard — the one
      // place that decides whether the user is still logged in. Clearing the
      // whole cache instead would notify no observer at all, and worse: the
      // mounted observers of the removed queries refetch on the spot, now
      // without a token. Emptying the cache stays where it is safe, in the
      // explicit logout paths.
      client.getQueryCache().find({ queryKey: SESSION_QUERY_KEY })?.reset();
    },
  });

  const client = new QueryClient({
    queryCache,
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return client;
}
