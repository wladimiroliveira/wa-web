import type { Me } from "@/features/auth/permission";
import { ApiError, request } from "@/lib/http";
import { clearSession, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";

export interface Credentials {
  username: string;
  password: string;
}

interface SessionPair {
  accessToken: string;
  /**
   * Optional because the API's default is to put it in an HttpOnly cookie and
   * answer with the access token alone. We ask for the body instead — see
   * {@link createSession} — and the type stays honest so the compiler makes us
   * prove it arrived.
   */
  refreshToken?: string;
}

export function fetchMe(): Promise<Me> {
  return request<Me>("/me");
}

export async function createSession(credentials: Credentials): Promise<Me> {
  const pair = await request<SessionPair>("/sessions", {
    method: "POST",
    // Without this the API keeps the refresh token in an HttpOnly cookie and
    // answers with the access token alone. This client has no cookie flow: it
    // reads the refresh token to rotate it, and to revoke it on logout.
    headers: { "x-refresh-delivery": "body" },
    body: JSON.stringify(credentials),
  });

  // A 200 we cannot use. Storing the absent token is what once turned a
  // contract change into a session that died a quarter of an hour later,
  // nowhere near its cause; failing here says so while the cause is on screen.
  if (!pair.refreshToken) {
    throw new ApiError(200, "O servidor não enviou o token de sessão. Verifique a configuração da API.");
  }

  setRefreshToken(pair.refreshToken);
  setAccessToken(pair.accessToken);

  return fetchMe();
}

export async function destroySession(): Promise<void> {
  try {
    if (getRefreshToken()) {
      // The body is a thunk on purpose. The call is bearer-gated, so an expired
      // access token makes it 401 and the interceptor rotates mid-flight; the
      // token captured before the call would already be dead by the time the
      // replay lands, and the API would keep the session alive.
      await request<void>("/sessions", {
        method: "DELETE",
        body: () => JSON.stringify({ refreshToken: getRefreshToken() }),
      });
    }
  } catch (error) {
    // Leaving has to leave: a failure here must not strand the user in a
    // session they asked to end. It does not vanish either — the refresh token
    // may still be live on the API, and that is worth a trace.
    console.warn("Could not revoke the session server-side; the refresh token may still be live.", error);
  } finally {
    clearSession();
  }
}
