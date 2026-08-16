import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";
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

  // The API delivers the refresh token in an HttpOnly cookie unless the caller
  // asks for it in the body. Without this header it answers with the access
  // token alone, and this client has no cookie flow to fall back on.
  test("asks the API to deliver the refresh token in the body, not in a cookie", async () => {
    let delivery: string | null = null;
    server.use(
      msw.post(`${API}/sessions`, ({ request: req }) => {
        delivery = req.headers.get("x-refresh-delivery");
        return HttpResponse.json({ accessToken: "access-1", refreshToken: "refresh-1" });
      }),
      msw.get(`${API}/me`, () => HttpResponse.json(ME)),
    );

    await createSession({ username: "owner", password: "secret123" });

    expect(delivery).toBe("body");
  });

  // Storing `undefined` here is what turned a contract change into a bug that
  // only surfaced when the access token expired, far from its cause.
  test("refuses a session response without a refresh token instead of storing one that is not there", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ accessToken: "access-1" })),
      msw.get(`${API}/me`, () => HttpResponse.json(ME)),
    );

    await expect(createSession({ username: "owner", password: "secret123" })).rejects.toThrow(/token de sessão/i);

    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
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

  test("revokes the token that is live when the API accepts the call, not the one held when it started", async () => {
    let revoked: unknown = null;
    server.use(
      msw.delete(`${API}/sessions`, async ({ request: req }) => {
        if (req.headers.get("Authorization") !== "Bearer access-2") {
          return HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 });
        }
        revoked = ((await req.json()) as { refreshToken: string }).refreshToken;
        return new HttpResponse(null, { status: 204 });
      }),
      msw.post(`${API}/sessions/refresh`, () =>
        HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-2" }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await destroySession();

    expect(revoked).toBe("refresh-2");
    expect(getRefreshToken()).toBeNull();
  });

  test("reports a failed revocation instead of dropping it silently", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    server.use(msw.delete(`${API}/sessions`, () => HttpResponse.error()));
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await destroySession();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
