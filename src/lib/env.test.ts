import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("returns the API base url when one is given", () => {
    expect(parseEnv({ NEXT_PUBLIC_API_BASE_URL: "http://api.test/v1" })).toEqual({ apiUrl: "http://api.test/v1" });
  });

  it("drops a trailing slash so callers can always prepend a path", () => {
    expect(parseEnv({ NEXT_PUBLIC_API_BASE_URL: "http://api.test/v1/" })).toEqual({ apiUrl: "http://api.test/v1" });
  });

  it("calls the API served by this same application when nothing is set", () => {
    expect(parseEnv({})).toEqual({ apiUrl: "/v1" });
    expect(parseEnv({ NEXT_PUBLIC_API_BASE_URL: "" })).toEqual({ apiUrl: "/v1" });
  });

  it("accepts a path on the same origin", () => {
    expect(parseEnv({ NEXT_PUBLIC_API_BASE_URL: "/api/v1/" })).toEqual({ apiUrl: "/api/v1" });
  });

  it("refuses a base url written without a scheme", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_API_BASE_URL: "localhost:3333" })).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("refuses a scheme the browser cannot fetch over", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_API_BASE_URL: "ftp://api.test/v1" })).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });
});
