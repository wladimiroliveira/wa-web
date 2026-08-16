import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createRole, deleteRole, fetchRoles, updateRole } from "@/features/roles/roles.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const role = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Estoquista",
  permissions: ["STOCK_READ", "STOCK_WRITE"],
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("roles.api", () => {
  test("lists roles", async () => {
    server.use(msw.get(`${API}/roles`, () => HttpResponse.json([role])));

    await expect(fetchRoles()).resolves.toEqual([role]);
  });

  test("creates a role with its permissions", async () => {
    let received: unknown;
    server.use(
      msw.post(`${API}/roles`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(role, { status: 201 });
      }),
    );

    await createRole({ name: "Estoquista", permissions: ["STOCK_READ", "STOCK_WRITE"] });

    expect(received).toEqual({ name: "Estoquista", permissions: ["STOCK_READ", "STOCK_WRITE"] });
  });

  test("updates a role", async () => {
    server.use(msw.patch(`${API}/roles/${role.id}`, () => HttpResponse.json({ ...role, name: "Estoque" })));

    await expect(updateRole(role.id, { name: "Estoque" })).resolves.toMatchObject({ name: "Estoque" });
  });

  test("deletes a role and tolerates the empty 204 body", async () => {
    server.use(msw.delete(`${API}/roles/${role.id}`, () => new HttpResponse(null, { status: 204 })));

    await expect(deleteRole(role.id)).resolves.toBeUndefined();
  });
});
