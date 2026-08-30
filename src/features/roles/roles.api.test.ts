import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createRole, deleteRole, fetchRoles, rolesKeys, updateRole } from "@/features/roles/roles.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aRole } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("roles api", () => {
  it("names the cache entry the whole feature shares", () => {
    expect(rolesKeys.all).toEqual(["roles"]);
  });

  it("lists the roles", async () => {
    const role = aRole();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([role])));

    await expect(fetchRoles()).resolves.toEqual([role]);
  });

  it("creates a role from the name and the chosen permissions", async () => {
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/roles"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole(), { status: 201 });
      }),
    );

    await createRole({ name: "Produção", permissions: ["PRODUCTION_READ"] });

    expect(received).toEqual({ name: "Produção", permissions: ["PRODUCTION_READ"] });
  });

  it("edits a role by id", async () => {
    let received: unknown = null;
    server.use(
      http.patch(apiUrl("/roles/role-1"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole({ name: "Produção" }));
      }),
    );

    await expect(updateRole("role-1", { name: "Produção" })).resolves.toEqual(aRole({ name: "Produção" }));
    expect(received).toEqual({ name: "Produção" });
  });

  it("deletes a role by id", async () => {
    let called = false;
    server.use(
      http.delete(apiUrl("/roles/role-1"), () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(deleteRole("role-1")).resolves.toBeUndefined();
    expect(called).toBe(true);
  });
});
