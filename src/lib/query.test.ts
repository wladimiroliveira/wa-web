import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http";
import { createQueryClient, shouldRetry } from "@/lib/query";

describe("shouldRetry", () => {
  it("does not retry what the server refused on purpose", () => {
    expect(shouldRetry(0, new ApiError(403, null))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, null))).toBe(false);
    expect(shouldRetry(0, new ApiError(409, null))).toBe(false);
  });

  it("retries a server fault, which is usually transient", () => {
    expect(shouldRetry(0, new ApiError(502, null))).toBe(true);
  });

  it("retries an unreachable API", () => {
    expect(shouldRetry(0, new ApiError(0, null))).toBe(true);
  });

  it("gives up after two retries — three network attempts in all", () => {
    expect(shouldRetry(1, new ApiError(502, null))).toBe(true);
    expect(shouldRetry(2, new ApiError(502, null))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("does not refetch on window focus, which a tablet triggers all day long", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("keeps data fresh for long enough that navigating back does not refetch", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(30_000);
  });

  // Without this, `shouldRetry` could be perfectly tested and never actually wired
  // in: deleting the line that installs it would leave every test green.
  it("installs the retry policy on the client, not merely beside it", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries?.retry).toBe(shouldRetry);
  });
});
