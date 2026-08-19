import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { useInvalidateSupplies } from "@/features/supplies/use-supply-mutations";
import { createQueryClient } from "@/lib/query";

describe("useInvalidateSupplies", () => {
  // Editing a supply's purchase price changes the price of every recipe that
  // uses it, and `["supplies"]` is not a prefix of `["recipes"]`. There is no
  // way to know which recipes use the supply without fetching all of them, so
  // the invalidation is deliberately coarse.
  test("invalidates the recipes too, because a supply's price changes theirs", () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useInvalidateSupplies(), { wrapper });
    result.current();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["supplies"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["recipes"] });
  });
});
