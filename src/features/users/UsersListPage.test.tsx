import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { UsersListPage } from "@/features/users/UsersListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const roles = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Estoquista",
    permissions: ["STOCK_READ"],
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

const users = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Maria Souza",
    username: "maria",
    email: "maria@example.com",
    roleId: "22222222-2222-4222-8222-222222222222",
    grantedPermissions: [],
    deniedPermissions: [],
    isActive: true,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "João Lima",
    username: "joao",
    email: "joao@example.com",
    roleId: null,
    grantedPermissions: [],
    deniedPermissions: [],
    isActive: false,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

function renderList(permissions: string[], onUsers = () => HttpResponse.json(users)) {
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
    msw.get(`${API}/users`, onUsers),
    msw.get(`${API}/roles`, () => HttpResponse.json(roles)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/users" element={<UsersListPage />} />
    </Routes>,
    { route: "/users" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("UsersListPage", () => {
  test("shows name, username, role and status", async () => {
    renderList(["USERS_READ", "USERS_WRITE"]);

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    const joao = (await screen.findByText("João Lima")).closest("tr")!;
    expect(joao).toHaveTextContent("joao");
    expect(joao).toHaveTextContent("—");
    expect(joao).toHaveTextContent("Inativo");
    expect((await screen.findByText("Maria Souza")).closest("tr")!).toHaveTextContent("Estoquista");
  });

  test("links each row to the user's screen when the reader may write", async () => {
    renderList(["USERS_READ", "USERS_WRITE"]);

    expect(await screen.findByRole("link", { name: "Maria Souza" })).toHaveAttribute(
      "href",
      "/users/33333333-3333-4333-8333-333333333333",
    );
  });

  test("hides the create button and the row links from a read-only reader", async () => {
    renderList(["USERS_READ"]);

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /novo usuário/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Maria Souza" })).not.toBeInTheDocument();
  });

  test("a failing list offers a retry that actually refetches", async () => {
    let attempts = 0;
    renderList(["USERS_READ"], () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ message: "Erro interno" }, { status: 500 })
        : HttpResponse.json(users);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno");

    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
  });
});
