export const REFRESH_TOKEN_KEY = "wa.refresh";

/**
 * The access token lives 15 minutes and stays in memory: a reload throws it
 * away, and no XSS payload can read it out of storage after the fact.
 *
 * The refresh token lives 30 days and has to survive a reload, and the API
 * hands it over in the response body rather than an httpOnly cookie, so
 * localStorage is the only option available. See wa-api#18.
 */
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
