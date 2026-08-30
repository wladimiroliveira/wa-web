import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, REFRESH_TIMEOUT_MS, SessionExpiredError } from "@/lib/http";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aRole, aSessionTokens } from "@/tests/samples";

/** Installs a Web Locks stand-in, since jsdom implements none. */
function useWebLocks(request: (name: string, task: () => Promise<unknown>) => Promise<unknown>): void {
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

/**
 * A stand-in that serializes, because that is what a lock IS. A pass-through double
 * would run every caller at once and let three racing requests each fire their own
 * refresh — the exact failure the single-flight test exists to catch, hidden behind
 * a green suite.
 */
function serializingLocks(): (name: string, task: () => Promise<unknown>) => Promise<unknown> {
  const tails = new Map<string, Promise<unknown>>();

  return (name, task) => {
    const previous = tails.get(name) ?? Promise.resolve();
    const run = previous.then(task, task);

    tails.set(
      name,
      run.catch(() => undefined),
    );

    return run;
  };
}

beforeEach(() => {
  clearSession();
  // In a browser the refresh runs under a real Web Lock. Standing one in keeps these
  // tests on the path production takes, and keeps the fallback's warning out of the
  // output. The fallback queue itself is covered by refresh-lock.test.ts.
  useWebLocks(serializingLocks());
});

afterEach(() => {
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
  vi.restoreAllMocks();
});

describe("request", () => {
  it("parses the body of a successful response", async () => {
    const role = aRole();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([role])));

    await expect(request("/roles")).resolves.toEqual([role]);
  });

  it("sends the access token when there is one", async () => {
    setAccessToken("access-token");
    let seen: string | null = null;
    server.use(
      http.get(apiUrl("/roles"), ({ request: received }) => {
        seen = received.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );

    await request("/roles");

    expect(seen).toBe("Bearer access-token");
  });

  it("returns nothing for 204, instead of choking on an empty body", async () => {
    setAccessToken("access-token");
    server.use(http.delete(apiUrl("/roles/1"), () => new HttpResponse(null, { status: 204 })));

    await expect(request("/roles/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the status and the parsed body", async () => {
    setAccessToken("access-token");
    server.use(
      http.post(apiUrl("/roles"), () =>
        HttpResponse.json({ message: "A role with this name already exists." }, { status: 409 }),
      ),
    );

    const error = await request("/roles", { method: "POST", body: "{}" }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).body).toEqual({ message: "A role with this name already exists." });
  });

  it("refreshes once for many requests racing on a 401, and replays them all", async () => {
    setAccessToken("stale-token");
    setRefreshToken("refresh-one");
    let refreshCalls = 0;

    server.use(
      http.post(apiUrl("/sessions/refresh"), async () => {
        refreshCalls += 1;
        return HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-two" }));
      }),
      http.get(apiUrl("/roles"), ({ request: received }) =>
        received.headers.get("Authorization") === "Bearer fresh-token"
          ? HttpResponse.json([aRole()])
          : HttpResponse.json({ message: "Authentication required." }, { status: 401 }),
      ),
    );

    const results = await Promise.all([request("/roles"), request("/roles"), request("/roles")]);

    expect(refreshCalls).toBe(1);
    expect(results).toEqual([[aRole()], [aRole()], [aRole()]]);
    expect(getAccessToken()).toBe("fresh-token");
    expect(getRefreshToken()).toBe("refresh-two");
  });

  it("reads the refresh token inside the lock, so it never replays one another tab rotated", async () => {
    setAccessToken("stale-token");
    setRefreshToken("dead-before-the-lock");
    let sent: string | null = null;

    // The rotation happens WHILE this caller waits for the lock, which is the whole
    // point: an implementation that read the token before waiting would send
    // "dead-before-the-lock" — the token the other tab already spent — and the API
    // would read that replay as theft and revoke every session the user owns.
    useWebLocks(async (_name, task) => {
      setRefreshToken("rotated-by-another-tab");
      return task();
    });

    server.use(
      http.post(apiUrl("/sessions/refresh"), async ({ request: received }) => {
        sent = ((await received.json()) as { refreshToken: string }).refreshToken;
        return HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-three" }));
      }),
      http.get(apiUrl("/roles"), ({ request: received }) =>
        received.headers.get("Authorization") === "Bearer fresh-token"
          ? HttpResponse.json([])
          : HttpResponse.json({ message: "Authentication required." }, { status: 401 }),
      ),
    );

    await request("/roles");

    expect(sent).toBe("rotated-by-another-tab");
  });

  it("ends the session when the API rejects the refresh token", async () => {
    setAccessToken("stale-token");
    setRefreshToken("revoked");
    server.use(
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
      http.get(apiUrl("/roles"), () => HttpResponse.json({ message: "Authentication required." }, { status: 401 })),
    );

    await expect(request("/roles")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("keeps the session when the refresh fails for a reason that is not the token", async () => {
    setAccessToken("stale-token");
    setRefreshToken("still-good");
    server.use(
      http.post(apiUrl("/sessions/refresh"), () => new HttpResponse(null, { status: 502 })),
      http.get(apiUrl("/roles"), () => HttpResponse.json({ message: "Authentication required." }, { status: 401 })),
    );

    const error = await request("/roles").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect((error as ApiError).status).toBe(502);
    expect(getRefreshToken()).toBe("still-good");
  });

  it("gives up on a refresh that hangs, instead of holding the cross-tab lock forever", async () => {
    setAccessToken("stale-token");
    setRefreshToken("still-good");
    // The real deadline is 15s. Shortening it here keeps the test honest about the
    // behaviour without making the suite wait for it.
    const deadline = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.timeout(20));

    server.use(
      http.post(apiUrl("/sessions/refresh"), async () => {
        await delay(500);
        return HttpResponse.json(aSessionTokens());
      }),
      http.get(apiUrl("/roles"), () => HttpResponse.json({ message: "Authentication required." }, { status: 401 })),
    );

    const error = await request("/roles").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect((error as ApiError).status).toBe(0);
    // The token was never rejected, only unreachable: the session has to survive.
    expect(getRefreshToken()).toBe("still-good");
    // Pin the real deadline, so a hardcoded literal or a wrong constant fails here.
    expect(deadline).toHaveBeenCalledWith(REFRESH_TIMEOUT_MS);
  });

  it("keeps the session when the endpoint itself answers 401 after a good refresh", async () => {
    setAccessToken("stale-token");
    setRefreshToken("refresh-one");

    server.use(
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-two" })),
      ),
      // A wrong current password answers 401 on a perfectly good session — the only
      // status the API documents for it. The operator must read "wrong password",
      // never "your session expired".
      http.patch(apiUrl("/sessions/me/password"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    const error = await request("/sessions/me/password", { method: "PATCH", body: "{}" }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect((error as ApiError).status).toBe(401);
    expect(getRefreshToken()).toBe("refresh-two");
  });

  it("does not intercept the sign-in route, so a wrong password is not read as an expired session", async () => {
    setRefreshToken("refresh-one");
    let refreshCalls = 0;
    server.use(
      http.post(apiUrl("/sessions/refresh"), () => {
        refreshCalls += 1;
        return HttpResponse.json(aSessionTokens());
      }),
      http.post(apiUrl("/sessions/signin"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    const error = await request("/sessions/signin", { method: "POST", body: "{}" }).catch((thrown: unknown) => thrown);

    expect(refreshCalls).toBe(0);
    expect((error as ApiError).status).toBe(401);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
  });

  it("re-evaluates a function body on the replay, so it carries the token the API will accept", async () => {
    setAccessToken("stale-token");
    setRefreshToken("refresh-one");
    const sentTokens: string[] = [];

    server.use(
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-two" })),
      ),
      http.post(apiUrl("/sessions/signout"), async ({ request: received }) => {
        sentTokens.push(((await received.json()) as { refreshToken: string }).refreshToken);
        return received.headers.get("Authorization") === "Bearer fresh-token"
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ message: "Authentication required." }, { status: 401 });
      }),
    );

    await request("/sessions/signout", {
      method: "POST",
      body: () => JSON.stringify({ refreshToken: getRefreshToken() }),
    });

    expect(sentTokens).toEqual(["refresh-one", "refresh-two"]);
  });
});
