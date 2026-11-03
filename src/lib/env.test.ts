import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("returns the API base url when the environment is complete", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "http://api.test/v1" })).toEqual({ apiUrl: "http://api.test/v1" });
  });

  it("drops a trailing slash so callers can always prepend a path", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "http://api.test/v1/" })).toEqual({ apiUrl: "http://api.test/v1" });
  });

  it("refuses a missing base url instead of building requests against undefined", () => {
    expect(() => parseEnv({})).toThrow(/VITE_API_BASE_URL/);
  });

  it("refuses a base url written without a scheme", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "localhost:3333" })).toThrow(/VITE_API_BASE_URL/);
  });

  it("refuses a scheme the browser cannot fetch over", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "ftp://api.test/v1" })).toThrow(/VITE_API_BASE_URL/);
  });
});
