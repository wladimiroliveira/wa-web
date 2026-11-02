import type { TestApp } from "@/server/testing/app";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { Permission } from "@prisma/client";
import { verifyPassword } from "@/server/modules/auth/auth.password";
import { authenticateAs, startTestApp } from "@/server/testing/app";
import { resetDatabase, testPrisma } from "@/server/testing/database";

const NEXT = "an-even-better-password";

let app: TestApp;

// A fresh application per case, not per file: the login rate limiter keeps its counters in the
// instance, and authenticateAs signs in with the same username in every case.
beforeEach(async () => {
  app = await startTestApp();
});

afterEach(async () => {
  await app.close();
  await resetDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("PATCH /v1/users/:id/password", () => {
  it("resets another person's password without asking for the old one", async () => {
    const { headers } = await authenticateAs(app, [Permission.ACCESS_UPDATE], "admin");
    const target = await authenticateAs(app, [], "target");

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/users/${target.userId}/password`,
      headers,
      payload: { newPassword: NEXT },
    });

    const stored = await testPrisma.user.findUnique({ where: { id: target.userId } });

    expect(response.statusCode).toBe(204);
    expect(await verifyPassword(NEXT, stored!.passwordHash)).toBe(true);
    expect((await app.inject({ method: "GET", url: "/v1/sessions/me", headers: target.headers })).statusCode).toBe(200);
    expect(await testPrisma.refreshToken.count({ where: { userId: target.userId, revokedAt: null } })).toBe(0);
  });

  it("answers 403 without ACCESS_UPDATE", async () => {
    const { headers } = await authenticateAs(app, [Permission.ACCESS_READ], "admin");
    const target = await authenticateAs(app, [], "target");

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/users/${target.userId}/password`,
      headers,
      payload: { newPassword: NEXT },
    });

    expect(response.statusCode).toBe(403);
  });
});
