import { screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

function meWith(permissions: string[]) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Owner",
    username: "owner",
    email: "owner@example.com",
    permissions,
  };
}

function renderGated(permissions: string[]) {
  server.use(msw.get(`${API}/me`, () => HttpResponse.json(meWith(permissions))));
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login screen</p>} />
      <Route element={<RequirePermission permission="SUPPLIES_READ" />}>
        <Route path="/" element={<p>supplies screen</p>} />
      </Route>
    </Routes>,
    { route: "/" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RequirePermission", () => {
  test("renders the route when the permission is granted", async () => {
    renderGated(["SUPPLIES_READ"]);

    expect(await screen.findByText("supplies screen")).toBeInTheDocument();
  });

  test("shows the forbidden screen when it is not — not the login screen", async () => {
    renderGated(["RECIPES_READ"]);

    expect(await screen.findByRole("heading", { name: /acesso negado/i })).toBeInTheDocument();
    expect(screen.queryByText("login screen")).not.toBeInTheDocument();
    expect(screen.queryByText("supplies screen")).not.toBeInTheDocument();
  });

  test("shows the forbidden screen for a user with no permissions at all", async () => {
    renderGated([]);

    expect(await screen.findByRole("heading", { name: /acesso negado/i })).toBeInTheDocument();
  });

  test("offers a way out of the forbidden screen — an empty sidebar is no escape", async () => {
    renderGated([]);

    expect(await screen.findByRole("link", { name: /início/i })).toHaveAttribute("href", "/");
  });
});
