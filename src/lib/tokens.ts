export const REFRESH_TOKEN_KEY = "wa.refresh";

// The access token is short-lived and stays in memory: a reload throws it away,
// and nothing that reads storage after the fact can find it.
//
// The refresh token has to survive a reload, and the API hands it over in the
// response body rather than an httpOnly cookie, so storage is the only place it
// can go. Reading it from storage — never from a variable — is also what lets a
// tab see the rotation another tab performed.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

/**
 * The HTTP layer clears the session from outside React, and neither module state nor
 * `localStorage` is something React can observe. Without this announcement the provider
 * keeps serving a cached user for a session that no longer exists, and the operator is
 * stranded on a screen whose retry button can never succeed.
 */
export function onSessionCleared(listener: SessionListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function clearSession(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  for (const listener of listeners) listener();
}
