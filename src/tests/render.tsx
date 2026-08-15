import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "@/lib/query";

interface RenderOptions {
  route?: string;
  /** Location state the route starts with — how the session guard passes `from`. */
  state?: unknown;
}

export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  const queryClient = createQueryClient();
  const entry = { pathname: options.route ?? "/", state: options.state ?? null };

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}
