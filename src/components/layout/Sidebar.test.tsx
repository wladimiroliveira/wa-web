import { screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Sidebar } from "@/components/layout/Sidebar";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

function renderSidebar(permissions: string[]) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions,
      }),
    ),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Sidebar />} />
      <Route path="/login" element={<p>login screen</p>} />
    </Routes>,
    { route: "/" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("NAV_ITEMS", () => {
  test("covers the six domain modules", () => {
    expect(NAV_ITEMS.map((item) => item.to)).toEqual([
      "/supplies",
      "/recipes",
      "/stock",
      "/productions",
      "/wastes",
      "/users",
    ]);
  });

  test("every item declares the permission it requires", () => {
    expect(NAV_ITEMS.every((item) => item.permission.length > 0)).toBe(true);
  });
});

describe("Sidebar", () => {
  test("shows only the entries the user is allowed to reach", async () => {
    renderSidebar(["SUPPLIES_READ", "RECIPES_READ"]);

    expect(await screen.findByRole("link", { name: "Insumos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Receitas" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Perdas" })).not.toBeInTheDocument();
  });

  test("shows every entry to a user holding every read permission", async () => {
    renderSidebar(NAV_ITEMS.map((item) => item.permission));

    for (const item of NAV_ITEMS) {
      expect(await screen.findByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  test("shows no entries at all to a user with no permissions", async () => {
    renderSidebar([]);

    expect(await screen.findByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
