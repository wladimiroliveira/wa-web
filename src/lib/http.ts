import { env } from "@/lib/env";
import { withRefreshLock } from "@/lib/refresh-lock";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import type { SessionTokens } from "@/lib/api";

/**
 * `message` is diagnostic text for whoever reads a log. It is never rendered:
 * the API answers in English and the interface is in Portuguese, so screens
 * translate from `status`, not from here.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API responded ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** The session is over and the user has to sign in again. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, null);
    this.name = "SessionExpiredError";
  }
}

/**
 * Routes the interceptor must leave alone, keyed on method and path. A failing
 * refresh cannot be allowed to call itself, and a rejected sign-in is a
 * credential error the user needs to read — not an expired session. Sign-out is
 * deliberately absent: it is bearer-gated, so it has to be intercepted like any
 * other call, or a sign-out after the access token expired revokes nothing.
 */
const UNINTERCEPTED_ROUTES = ["POST /sessions/signin", "POST /sessions/refresh"];

/** Deadline for the refresh call. It is held under the cross-tab lock; see its use below. */
export const REFRESH_TIMEOUT_MS = 15_000;

type RequestBody = BodyInit | (() => BodyInit) | null;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /**
   * A plain body is sent as-is. A function is called once per attempt, so a
   * replay after a rotation carries the value that is current then — the
   * sign-out body has to hold the refresh token the API will actually accept.
   */
  body?: RequestBody;
}

/**
 * A request that never reached the API is a status-less failure, not an HTTP one.
 * `shouldRetry` treats status 0 as worth another attempt, and screens translate it
 * into "cannot reach the server" instead of a generic failure that tells the
 * operator nothing about what to do next.
 */
async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${env.apiUrl}${path}`, init);
  } catch {
    throw new ApiError(0, null);
  }
}

function buildInit(init: RequestOptions, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  const body = typeof init.body === "function" ? init.body() : init.body;

  if (typeof body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  return { ...init, body, headers };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);

  return new ApiError(response.status, body);
}

async function ensureFreshAccessToken(staleToken: string | null): Promise<string> {
  return withRefreshLock(async () => {
    // Another request in this tab may have rotated while we waited for the lock.
    // The access token is per-tab memory, so this short-circuit only ever fires
    // for same-tab races; it does nothing for another tab.
    const current = getAccessToken();
    if (current !== null && current !== staleToken) return current;

    // Read the refresh token from storage INSIDE the lock. This is what makes
    // the cross-tab case safe: another tab may have rotated already and written
    // the new token here. Reading it before the lock would send the old one, and
    // the API reads a replay as theft.
    const refreshToken = getRefreshToken();

    if (refreshToken === null) {
      clearSession();
      throw new SessionExpiredError();
    }

    const response = await send("/sessions/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      // This call runs inside the refresh lock, and the lock is held for as long
      // as it is pending. Without a deadline, one tab whose request hangs blocks
      // rotation in every other tab of the origin, indefinitely. The timeout is
      // what bounds that: it lands in `send`'s catch, which keeps the session
      // and turns the failure into a retry.
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Only the API saying "this token is no longer yours" ends the session. A
      // 502 from a restarting API would otherwise throw away a refresh token the
      // server still honours and force a needless sign-in.
      if (response.status === 401 || response.status === 403) {
        clearSession();
        throw new SessionExpiredError();
      }

      throw await toApiError(response);
    }

    const pair = (await response.json()) as SessionTokens;

    setRefreshToken(pair.refreshToken);
    setAccessToken(pair.accessToken);

    return pair.accessToken;
  });
}

export async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const interceptable = !UNINTERCEPTED_ROUTES.includes(`${method} ${path}`);
  const token = getAccessToken();

  let response = await send(path, buildInit(init, token));

  if (response.status === 401 && interceptable) {
    const fresh = await ensureFreshAccessToken(token);

    // A second 401, on a token the API just issued, is the endpoint's own answer —
    // not a dead session. `PATCH /sessions/me/password` returns 401 for a wrong
    // current password, and it is the only status the API documents for that. Ending
    // the session here would sign an operator out of the shop-floor tablet over a
    // typo, and the screen would say "your session expired" instead of "wrong
    // password". The refresh endpoint's own 401/403 stays the sole authority on
    // whether a session is over.
    response = await send(path, buildInit(init, fresh));
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
