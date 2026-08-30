import { HttpResponse, delay, http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import { SessionProvider } from "@/features/auth/session-context";
import { apiUrl, server } from "@/tests/msw-server";
import { aCurrentUser, aSessionTokens } from "@/tests/samples";

/**
 * Not `renderWithProviders`: that helper wraps its `ui` in its own `MemoryRouter`,
 * and nesting a second router inside a `RouterProvider` throws. This is the router
 * itself under test, so it needs `createMemoryRouter` driving `routes` directly.
 */
function renderApp(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries });

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

describe("routes", () => {
  it("sends an anonymous visitor to sign in, then back to the page they asked for", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json(aSessionTokens())),
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
      http.get(apiUrl("/roles"), async () => {
        // Delayed on purpose: the round trip is not complete until the destination
        // screen has rendered its own loading state, not just its heading.
        await delay(20);
        return HttpResponse.json([]);
      }),
    );

    renderApp(["/roles"]);

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Papéis" })).toBeInTheDocument();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();

    expect(await screen.findByText("Nenhum papel cadastrado ainda.")).toBeInTheDocument();
  });
});
