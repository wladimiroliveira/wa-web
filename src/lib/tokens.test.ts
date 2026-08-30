import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  REFRESH_TOKEN_KEY,
  setAccessToken,
  setRefreshToken,
} from "@/lib/tokens";

describe("token storage", () => {
  beforeEach(() => {
    clearSession();
  });

  it("starts with no session at all", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("keeps the access token in memory, out of storage", () => {
    setAccessToken("access-token");

    expect(getAccessToken()).toBe("access-token");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("persists the refresh token so the session survives a reload", () => {
    setRefreshToken("refresh-token");

    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("reads the refresh token another tab wrote", () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "written-by-another-tab");

    expect(getRefreshToken()).toBe("written-by-another-tab");
  });

  it("clears both halves, so signing out leaves nothing behind", () => {
    setAccessToken("access-token");
    setRefreshToken("refresh-token");

    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
