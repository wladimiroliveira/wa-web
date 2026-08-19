import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { createMemoryRouter, matchRoutes, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { routes } from "@/app/router";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/query";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

beforeEach(() => {
  clearSession();
});

describe("router", () => {
  // The route tree used to be generated from NAV_ITEMS, which made this true by
  // construction. Now that real screens are declared by hand, it needs a test.
  test.each(NAV_ITEMS.map((item) => item.to))("%s resolves to a route", (to) => {
    expect(matchRoutes(routes, to)).not.toBeNull();
  });

  test("the roles screen is reachable from the menu", () => {
    expect(NAV_ITEMS.map((item) => item.to)).toContain("/roles");
  });

  // The write screens are gated by the route, not by hiding a button: typing
  // the address must not be a way in.
  test.each(["/users/new", "/roles/new", "/supplies/new", "/recipes/new"])(
    "%s shows the forbidden screen to a read-only user",
    async (path) => {
      server.use(
        msw.get(`${API}/me`, () =>
          HttpResponse.json({
            id: "11111111-1111-4111-8111-111111111111",
            name: "Leitora",
            username: "leitora",
            email: "leitora@example.com",
            permissions: ["USERS_READ"],
          }),
        ),
        msw.get(`${API}/roles`, () => HttpResponse.json([])),
        msw.get(`${API}/users`, () => HttpResponse.json([])),
        msw.get(`${API}/supplies`, () => HttpResponse.json([])),
        msw.get(`${API}/recipes`, () => HttpResponse.json([])),
      );
      setAccessToken("access-1");
      setRefreshToken("refresh-1");

      // The app's own router, not a stand-in: this asserts the real route tree.
      // `renderWithProviders` wraps its child in a `MemoryRouter`, and
      // `createMemoryRouter` builds its own — React Router refuses to nest one
      // router inside another, so this renders `RouterProvider` directly with a
      // hand-rolled `QueryClientProvider` instead of using the helper.
      const router = createMemoryRouter(routes, { initialEntries: [path] });
      const queryClient = createQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      expect(await screen.findByRole("heading", { name: /acesso negado/i })).toBeInTheDocument();
    },
  );

  // PRICING_READ and RECIPES_READ are independent in the API's enum, and the
  // pricing screen reads a route behind each one.
  test.each([
    ["without RECIPES_READ", ["PRICING_READ"]],
    ["without PRICING_READ", ["RECIPES_READ"]],
  ])("the pricing screen is forbidden %s", async (_label, permissions) => {
    server.use(
      msw.get(`${API}/me`, () =>
        HttpResponse.json({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Leitora",
          username: "leitora",
          email: "leitora@example.com",
          permissions,
        }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    const router = createMemoryRouter(routes, {
      initialEntries: ["/recipes/44444444-4444-4444-8444-444444444444/pricing"],
    });
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: /acesso negado/i })).toBeInTheDocument();
  });
});
