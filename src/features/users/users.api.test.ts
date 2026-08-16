import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createUser, fetchUser, fetchUserPermissions, fetchUsers, updateUser } from "@/features/users/users.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const user = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Maria Souza",
  username: "maria",
  email: "maria@example.com",
  roleId: "22222222-2222-4222-8222-222222222222",
  grantedPermissions: ["SUPPLIES_WRITE"],
  deniedPermissions: [],
  isActive: true,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("users.api", () => {
  test("lists users", async () => {
    server.use(msw.get(`${API}/users`, () => HttpResponse.json([user])));

    await expect(fetchUsers()).resolves.toEqual([user]);
  });

  test("reads a single user", async () => {
    server.use(msw.get(`${API}/users/${user.id}`, () => HttpResponse.json(user)));

    await expect(fetchUser(user.id)).resolves.toEqual(user);
  });

  test("reads the effective permissions the API computed", async () => {
    server.use(
      msw.get(`${API}/users/${user.id}/permissions`, () =>
        HttpResponse.json({ userId: user.id, permissions: ["STOCK_READ", "SUPPLIES_WRITE"] }),
      ),
    );

    await expect(fetchUserPermissions(user.id)).resolves.toEqual(["STOCK_READ", "SUPPLIES_WRITE"]);
  });

  test("creates a user with the password the API only accepts on creation", async () => {
    let received: unknown;
    server.use(
      msw.post(`${API}/users`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(user, { status: 201 });
      }),
    );

    await createUser({
      name: "Maria Souza",
      username: "maria",
      email: "maria@example.com",
      password: "segredo123",
      roleId: null,
      grantedPermissions: [],
      deniedPermissions: [],
    });

    expect(received).toMatchObject({ username: "maria", password: "segredo123" });
  });

  test("updates a user", async () => {
    server.use(msw.patch(`${API}/users/${user.id}`, () => HttpResponse.json({ ...user, isActive: false })));

    await expect(updateUser(user.id, { isActive: false })).resolves.toMatchObject({ isActive: false });
  });
});
