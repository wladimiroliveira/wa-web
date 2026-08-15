import { beforeEach, describe, expect, test } from "vitest";
import {
  REFRESH_TOKEN_KEY,
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/lib/tokens";

beforeEach(() => {
  clearSession();
});

describe("access token", () => {
  test("is null before anything is stored", () => {
    expect(getAccessToken()).toBeNull();
  });

  test("round-trips through memory", () => {
    setAccessToken("access-1");
    expect(getAccessToken()).toBe("access-1");
  });

  test("never touches localStorage, so XSS cannot read it back after a reload", () => {
    setAccessToken("access-1");
    expect(localStorage.length).toBe(0);
  });
});

describe("refresh token", () => {
  test("round-trips through localStorage under a namespaced key", () => {
    setRefreshToken("refresh-1");
    expect(getRefreshToken()).toBe("refresh-1");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-1");
  });

  test("is null when nothing was stored", () => {
    expect(getRefreshToken()).toBeNull();
  });
});

describe("clearSession", () => {
  test("drops both tokens", () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
