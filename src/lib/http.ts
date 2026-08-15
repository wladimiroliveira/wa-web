import { env } from "@/lib/env";
import { withRefreshLock } from "@/lib/refresh-lock";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, "Sua sessão expirou. Entre novamente.");
    this.name = "SessionExpiredError";
  }
}

/**
 * Routes the interceptor must leave alone, keyed on method **and** path. A
 * failing refresh cannot be allowed to call itself, and a login rejection is a
 * credential error the user needs to read — not a session expiry. `DELETE
 * /sessions` shares the path with the login but is bearer-gated, so it has to
 * be intercepted like any other call: otherwise a logout after the access token
 * expired never revokes anything.
 */
const UNINTERCEPTED_ROUTES = ["POST /sessions", "POST /sessions/refresh"];

interface SessionPair {
  accessToken: string;
  refreshToken: string;
}

/** A function body is re-evaluated per attempt; see {@link RequestOptions}. */
type RequestBody = BodyInit | (() => BodyInit) | null;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /**
   * A plain body is sent as-is. A function is called once per attempt, so a
   * replay after a token rotation carries the value that is current then — the
   * logout body has to hold the refresh token the API will actually accept.
   */
  body?: RequestBody;
}

function buildInit(init: RequestOptions, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  const body = typeof init.body === "function" ? init.body() : init.body;
  if (typeof body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, body, headers };
}

/** Normalizes the three error shapes the API's errorSchema allows. */
async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { message?: unknown; code?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message : "Não foi possível concluir a operação.";
  const code = typeof body?.code === "string" ? body.code : undefined;
  return new ApiError(response.status, message, code);
}

async function ensureFreshAccessToken(staleToken: string | null): Promise<string> {
  return withRefreshLock(async () => {
    // Someone else — another request in this tab — may have rotated while we
    // waited for the lock. If so, the work is already done. The access token
    // is per-tab in-memory state, so this short-circuit only ever fires for
    // same-tab races; it does nothing for another tab.
    const current = getAccessToken();
    if (current && current !== staleToken) return current;

    // Read the refresh token from storage INSIDE the lock. This is what makes
    // the cross-tab case safe: another tab may have already rotated and
    // written the new refresh token here. Reading it before the lock would
    // send the old one, and the API treats a replay as theft.
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      throw new SessionExpiredError();
    }

    let response: Response;
    try {
      response = await fetch(`${env.apiUrl}/sessions/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Offline or the API is unreachable. The stored refresh token is still
      // good, so this is a retry, not a logout.
      throw new ApiError(0, "Não foi possível falar com o servidor. Tente de novo.");
    }

    if (!response.ok) {
      // Only the API saying "this token is no longer yours" ends the session. A
      // 502 from a restarting API would otherwise throw away a refresh token
      // the server still honours and force a needless re-login.
      if (response.status === 401 || response.status === 403) {
        clearSession();
        throw new SessionExpiredError();
      }
      throw await toApiError(response);
    }

    const pair = (await response.json()) as SessionPair;
    setRefreshToken(pair.refreshToken);
    setAccessToken(pair.accessToken);
    return pair.accessToken;
  });
}

export async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const interceptable = !UNINTERCEPTED_ROUTES.includes(`${method} ${path}`);
  const token = getAccessToken();
  let response = await fetch(`${env.apiUrl}${path}`, buildInit(init, token));

  if (response.status === 401 && interceptable) {
    const fresh = await ensureFreshAccessToken(token);
    response = await fetch(`${env.apiUrl}${path}`, buildInit(init, fresh));

    if (response.status === 401) {
      clearSession();
      throw new SessionExpiredError();
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
