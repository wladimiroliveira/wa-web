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
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await request<void>("/sessions", { method: "DELETE", body: JSON.stringify({ refreshToken }) });
    }
  } catch {
    // Leaving has to leave. A network failure revoking the token server-side
    // must not strand the user in a session they asked to end.
  } finally {
    clearSession();
  }
}
