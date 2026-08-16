import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

// sonner's <Toaster/> asks next-themes for the OS color scheme on mount, and
// jsdom has no matchMedia. Only this test file mounts a <Toaster/>, so the
// stand-in lives here instead of in the shared test setup (see
// UserFormPage.test.tsx, which does the same).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

const API = "http://localhost:3333";

const role = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Estoquista",
  permissions: ["STOCK_READ", "STOCK_WRITE"],
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

function renderList(permissions: string[]) {
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
    msw.get(`${API}/roles`, () => HttpResponse.json([role])),
    msw.get(`${API}/users`, () => HttpResponse.json([])),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      {/* Mounted here, not via renderWithProviders: in the app it lives once in
          src/app/providers.tsx, outside the router. Tests that need to observe
          a toast render it locally instead of changing shared test setup. */}
      <Toaster />
      <Routes>
        <Route path="/roles" element={<RolesListPage />} />
      </Routes>
    </>,
    { route: "/roles" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RolesListPage", () => {
  test("shows each role and how many permissions it grants", async () => {
    renderList(["USERS_READ", "USERS_WRITE"]);

    const row = (await screen.findByText("Estoquista")).closest("tr")!;
    expect(row).toHaveTextContent("2");
  });

  test("deleting asks first and only calls the API after confirmation", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/roles/${role.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderList(["USERS_READ", "USERS_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    expect(deleted).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir papel$/i }));

    expect(deleted).toBe(true);
  });

  test("hides the destructive actions from a read-only reader", async () => {
    renderList(["USERS_READ"]);

    expect(await screen.findByText("Estoquista")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /novo papel/i })).not.toBeInTheDocument();
  });

  test("a failed deletion is not something this screen can fix, so it becomes a toast", async () => {
    server.use(
      msw.delete(`${API}/roles/${role.id}`, () => HttpResponse.json({ message: "Erro interno" }, { status: 500 })),
    );
    renderList(["USERS_READ", "USERS_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^excluir papel$/i }));

    expect(await screen.findByText("Erro interno")).toBeInTheDocument();
  });
});
