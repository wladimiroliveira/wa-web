import type { ChangePasswordBody, CurrentUser, LoginBody, SessionTokens } from "@/lib/api";
import { request } from "@/lib/http";
import { getRefreshToken } from "@/lib/tokens";

export function requestSignIn(body: LoginBody): Promise<SessionTokens> {
  return request<SessionTokens>("/sessions/signin", { method: "POST", body: JSON.stringify(body) });
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>("/sessions/me");
}

// The body is a function on purpose: if the access token expired, this call is
// replayed after a rotation, and the replay has to carry the refresh token the
// API will accept — not the one that was current when the call started.
export function requestSignOut(): Promise<void> {
  return request<void>("/sessions/signout", {
    method: "POST",
    body: () => JSON.stringify({ refreshToken: getRefreshToken() }),
  });
}

export function changeOwnPassword(body: ChangePasswordBody): Promise<void> {
  return request<void>("/sessions/me/password", { method: "PATCH", body: JSON.stringify(body) });
}
