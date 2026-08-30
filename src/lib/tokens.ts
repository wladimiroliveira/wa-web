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

export function clearSession(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
