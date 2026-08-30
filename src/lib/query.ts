import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/http";

const MAX_RETRIES = 2;
const STALE_TIME_MS = 30_000;

/**
 * A 4xx is the server having decided: repeating it changes nothing and only
 * delays the error the operator has to read. A 5xx, or an unreachable API, is
 * worth another attempt.
 *
 * `failureCount` counts attempts that have ALREADY failed, and the first attempt
 * never reaches this function — so `MAX_RETRIES` of 2 means three network
 * requests in all for a persistent fault. The constant is named for what it
 * bounds; calling it a maximum number of attempts would understate it by one.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;

  return true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        // A tablet on the shop floor leaves and re-enters the app all day. The
        // default would turn every return into a burst of requests, which the
        // operator reads as the screen freezing.
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      // A mutation is a write, and these writes are not idempotent: repeating one
      // risks a duplicate record on the shop floor. A stuck write fails fast and
      // lets the operator decide, rather than guessing on their behalf.
      mutations: { retry: false },
    },
  });
}
