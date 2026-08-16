import { describe, expect, test } from "vitest";
import { readEnv } from "@/lib/env";

describe("readEnv", () => {
  test("returns the API base URL", () => {
    expect(readEnv({ VITE_API_URL: "http://localhost:3333" })).toEqual({ apiUrl: "http://localhost:3333" });
  });

  test("strips a trailing slash so paths never produce a double slash", () => {
    expect(readEnv({ VITE_API_URL: "http://localhost:3333/" })).toEqual({ apiUrl: "http://localhost:3333" });
  });

  test("throws a named error when VITE_API_URL is missing", () => {
    expect(() => readEnv({})).toThrow(/VITE_API_URL/);
  });

  test("throws when VITE_API_URL is not a URL", () => {
    expect(() => readEnv({ VITE_API_URL: "localhost:3333" })).toThrow(/VITE_API_URL/);
  });
});
