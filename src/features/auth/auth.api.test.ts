import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createSession, destroySession, fetchMe } from "@/features/auth/auth.api";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const ME = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Owner",
  username: "owner",
  email: "owner@example.com",
  permissions: ["SUPPLIES_READ"],
};

beforeEach(() => {
  clearSession();
});

describe("createSession", () => {
  test("stores both tokens and resolves with the current user", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ accessToken: "access-1", refreshToken: "refresh-1" })),
      msw.get(`${API}/me`, () => HttpResponse.json(ME)),
    );

    await expect(createSession({ username: "owner", password: "secret123" })).resolves.toEqual(ME);

    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  test("propagates the API's message for bad credentials", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ message: "Credenciais inválidas" }, { status: 401 })),
    );

    await expect(createSession({ username: "owner", password: "wrong" })).rejects.toMatchObject({
      status: 401,
      message: "Credenciais inválidas",
    });
  });

  test("propagates the rate limit as a 429", async () => {
    server.use(msw.post(`${API}/sessions`, () => HttpResponse.json({ message: "Too many requests" }, { status: 429 })));

    await expect(createSession({ username: "owner", password: "secret123" })).rejects.toMatchObject({ status: 429 });
  });
});

describe("destroySession", () => {
  test("revokes the refresh token on the API and clears local state", async () => {
    let body: unknown = null;
    server.use(
      msw.delete(`${API}/sessions`, async ({ request: req }) => {
        body = await req.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await destroySession();

    expect(body).toEqual({ refreshToken: "refresh-1" });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test("still clears local state when the API cannot be reached — leaving has to leave", async () => {
    server.use(msw.delete(`${API}/sessions`, () => HttpResponse.error()));
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await expect(destroySession()).resolves.toBeUndefined();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test("does not call the API when there is nothing to revoke", async () => {
    let called = false;
    server.use(
      msw.delete(`${API}/sessions`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await destroySession();

    expect(called).toBe(false);
  });
});

describe("fetchMe", () => {
  test("returns the user with the effective permissions the API computed", async () => {
    server.use(msw.get(`${API}/me`, () => HttpResponse.json(ME)));
    setAccessToken("access-1");

    await expect(fetchMe()).resolves.toEqual(ME);
  });
});
