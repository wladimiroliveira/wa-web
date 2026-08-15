import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { ApiError, SessionExpiredError, request } from "@/lib/http";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

beforeEach(() => {
  clearSession();
});

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
