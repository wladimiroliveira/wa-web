import type { Me } from "@/features/auth/permission";
import { request } from "@/lib/http";
import { clearSession, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";

export interface Credentials {
  username: string;
  password: string;
}

interface SessionPair {
  accessToken: string;
  refreshToken: string;
}

export function fetchMe(): Promise<Me> {
  return request<Me>("/me");
}

export async function createSession(credentials: Credentials): Promise<Me> {
  const pair = await request<SessionPair>("/sessions", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

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
