import { HttpResponse, http as msw } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError, SessionExpiredError, request } from "@/lib/http";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "locks");
});

/**
 * Stands in for Web Locks with another tab already queued ahead of us: by the
 * time this tab is handed the lock, that tab has rotated and written its new
 * refresh token to storage. jsdom has neither Web Locks nor a second tab, and
 * this ordering is the only one that tells "read inside the lock" apart from
 * "read before waiting for it".
 */
function installLocksStubThatRotatesWhileWeWait(rotatedToken: string) {
  const request = vi.fn(async <T>(_name: string, task: () => Promise<T>): Promise<T> => {
    await Promise.resolve();
    setRefreshToken(rotatedToken);
    return task();
  });

  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

describe("request", () => {
  test("attaches the bearer token when there is one", async () => {
    let seen: string | null = null;
    server.use(
      msw.get(`${API}/supplies`, ({ request: req }) => {
        seen = req.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );
    setAccessToken("access-1");

    await request("/supplies");

    expect(seen).toBe("Bearer access-1");
  });

  test("omits the header entirely when there is no token", async () => {
    let seen: string | null = "not-called";
    server.use(
      msw.get(`${API}/supplies`, ({ request: req }) => {
        seen = req.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );

    await request("/supplies");

    expect(seen).toBeNull();
  });

  test("returns undefined for a 204 instead of failing to parse an empty body", async () => {
    server.use(msw.delete(`${API}/sessions`, () => new HttpResponse(null, { status: 204 })));
    setAccessToken("access-1");

    await expect(request("/sessions", { method: "DELETE" })).resolves.toBeUndefined();
  });

  test("raises an ApiError carrying the API's own message and code", async () => {
    server.use(
      msw.post(`${API}/supplies`, () =>
        HttpResponse.json({ code: "DIMENSION_MISMATCH", message: "Dimensões diferentes." }, { status: 400 }),
      ),
    );
    setAccessToken("access-1");

    await expect(request("/supplies", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 400,
      code: "DIMENSION_MISMATCH",
      message: "Dimensões diferentes.",
    });
  });

  test("keeps a caller-supplied Content-Type instead of overwriting it with application/json", async () => {
    let seen: string | null = null;
    server.use(
      msw.post(`${API}/supplies`, ({ request: req }) => {
        seen = req.headers.get("Content-Type");
        return HttpResponse.json([]);
      }),
    );

    await request("/supplies", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "plain text",
    });

    expect(seen).toBe("text/plain");
  });
});

describe("the refresh interceptor", () => {
  test("refreshes on 401 and replays the original request once", async () => {
    let attempts = 0;
    server.use(
      msw.get(`${API}/supplies`, ({ request: req }) => {
        attempts += 1;
        if (req.headers.get("Authorization") !== "Bearer access-2") {
          return HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 });
        }
        return HttpResponse.json([{ id: "s1" }]);
      }),
      msw.post(`${API}/sessions/refresh`, () =>
        HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-2" }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await expect(request("/supplies")).resolves.toEqual([{ id: "s1" }]);

    expect(attempts).toBe(2);
    expect(getAccessToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  test("gives up and clears the session when the replay is also rejected", async () => {
    server.use(
      msw.get(`${API}/supplies`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () =>
        HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-2" }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await expect(request("/supplies")).rejects.toBeInstanceOf(SessionExpiredError);

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test("clears the session when the refresh itself is rejected", async () => {
    server.use(
      msw.get(`${API}/supplies`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () => HttpResponse.json({ message: "Token inválido" }, { status: 401 })),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await expect(request("/supplies")).rejects.toBeInstanceOf(SessionExpiredError);

    expect(getRefreshToken()).toBeNull();
  });

  test("clears the session when the refresh is refused as forbidden", async () => {
    server.use(
      msw.get(`${API}/supplies`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () => HttpResponse.json({ message: "Sessão revogada" }, { status: 403 })),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await expect(request("/supplies")).rejects.toBeInstanceOf(SessionExpiredError);

    expect(getRefreshToken()).toBeNull();
  });

  test("keeps the session when the refresh fails transiently — a 502 is a restarting API, not a dead session", async () => {
    server.use(
      msw.get(`${API}/supplies`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () => HttpResponse.json({ message: "Bad gateway" }, { status: 502 })),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    const error = await request("/supplies").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect((error as ApiError).status).toBe(502);
    expect(getRefreshToken()).toBe("refresh-1");
  });

  test("keeps the session when the refresh cannot reach the API at all", async () => {
    server.use(
      msw.get(`${API}/supplies`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () => HttpResponse.error()),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    const error = await request("/supplies").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect(getRefreshToken()).toBe("refresh-1");
  });

  test("does not attempt a refresh when there is no refresh token to rotate", async () => {
    let refreshCalls = 0;
    server.use(
      msw.get(`${API}/supplies`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: "x", refreshToken: "y" });
      }),
    );

    await expect(request("/supplies")).rejects.toBeInstanceOf(SessionExpiredError);

    expect(refreshCalls).toBe(0);
  });

  test("keeps the API's message on a login 401 instead of turning it into a session expiry", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ message: "Credenciais inválidas" }, { status: 401 })),
    );

    const error = await request("/sessions", { method: "POST", body: "{}" }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect((error as ApiError).message).toBe("Credenciais inválidas");
  });

  test("intercepts a 401 on DELETE /sessions — logging out still has to revoke server-side", async () => {
    let attempts = 0;
    server.use(
      msw.delete(`${API}/sessions`, ({ request: req }) => {
        attempts += 1;
        if (req.headers.get("Authorization") !== "Bearer access-2") {
          return HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 });
        }
        return new HttpResponse(null, { status: 204 });
      }),
      msw.post(`${API}/sessions/refresh`, () =>
        HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-2" }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await expect(request("/sessions", { method: "DELETE", body: "{}" })).resolves.toBeUndefined();

    expect(attempts).toBe(2);
  });

  test("re-evaluates a function body on the replay, so it carries the freshly rotated token", async () => {
    const bodies: unknown[] = [];
    server.use(
      msw.delete(`${API}/sessions`, async ({ request: req }) => {
        bodies.push(await req.json());
        if (req.headers.get("Authorization") !== "Bearer access-2") {
          return HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 });
        }
        return new HttpResponse(null, { status: 204 });
      }),
      msw.post(`${API}/sessions/refresh`, () =>
        HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-2" }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await request("/sessions", {
      method: "DELETE",
      body: () => JSON.stringify({ refreshToken: getRefreshToken() }),
    });

    expect(bodies).toEqual([{ refreshToken: "refresh-1" }, { refreshToken: "refresh-2" }]);
  });

  test("sends the refresh token read inside the lock, not the one held before waiting for it", async () => {
    installLocksStubThatRotatesWhileWeWait("refresh-from-other-tab");

    let sent: unknown = null;
    server.use(
      msw.get(`${API}/supplies`, ({ request: req }) =>
        req.headers.get("Authorization") === "Bearer access-2"
          ? HttpResponse.json([])
          : HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 }),
      ),
      msw.post(`${API}/sessions/refresh`, async ({ request: req }) => {
        sent = ((await req.json()) as { refreshToken: string }).refreshToken;
        return HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-3" });
      }),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await request("/supplies");

    // "refresh-1" here would be a replay of a token the other tab already
    // rotated, and the API reads a replay as theft and kills the session.
    expect(sent).toBe("refresh-from-other-tab");
  });

  test("N concurrent 401s trigger exactly one POST /sessions/refresh", async () => {
    let refreshCalls = 0;
    server.use(
      msw.get(`${API}/supplies`, ({ request: req }) =>
        req.headers.get("Authorization") === "Bearer access-2"
          ? HttpResponse.json([])
          : HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 }),
      ),
      msw.post(`${API}/sessions/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ accessToken: "access-2", refreshToken: "refresh-2" });
      }),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    await Promise.all(Array.from({ length: 5 }, () => request("/supplies")));

    expect(refreshCalls).toBe(1);
  });
});
