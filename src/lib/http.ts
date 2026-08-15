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
 * Paths the interceptor must leave alone. A failing refresh cannot be allowed
 * to call itself, and a login rejection is a credential error the user needs to
 * read — not a session expiry.
 */
const UNINTERCEPTED_PATHS = ["/sessions", "/sessions/refresh"];

interface SessionPair {
  accessToken: string;
  refreshToken: string;
}

function buildInit(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
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
    // Someone else — another request in this tab, or another tab — may have
    // rotated while we waited for the lock. If so, the work is already done.
    const current = getAccessToken();
    if (current && current !== staleToken) return current;

    // Read the refresh token from storage INSIDE the lock. Another tab has
    // already written the new one here; reading it before the lock would send
    // the old one, and the API treats a replay as theft.
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      throw new SessionExpiredError();
    }

    const response = await fetch(`${env.apiUrl}/sessions/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearSession();
      throw new SessionExpiredError();
    }

    const pair = (await response.json()) as SessionPair;
    setRefreshToken(pair.refreshToken);
    setAccessToken(pair.accessToken);
    return pair.accessToken;
  });
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const interceptable = !UNINTERCEPTED_PATHS.includes(path);
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
