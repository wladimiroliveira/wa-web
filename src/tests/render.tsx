import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { SessionProvider } from "@/features/auth/session-context";
import { navigation } from "@/tests/navigation";

/** Retries are off here: a test asserting an error state should not wait for them. */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export interface RenderOptions {
  /** The address the screen opens at, query string included. */
  route?: string;
  /** What a dynamic segment of that address holds, as `useParams` would read it. */
  params?: Record<string, string>;
}

/**
 * The providers go through Testing Library's `wrapper` option rather than being wrapped
 * around the JSX by hand. That is what makes the returned `rerender` usable: it
 * re-renders only what it is given, so hand-wrapped providers would be dropped on the
 * second render and the component would fail looking for a context that was there a
 * moment before.
 */
export function renderWithProviders(ui: ReactElement, { route = "/", params = {} }: RenderOptions = {}): RenderResult {
  const queryClient = createTestQueryClient();

  navigation.reset(route, params);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Providers });
}
