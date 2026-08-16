import { describe, expect, test } from "vitest";
import { formatCurrency, formatQuantity } from "@/lib/format";

/** Intl separates the currency symbol with U+00A0, which is invisible in a diff. */
const normalize = (value: string) => value.replace(/ /g, " ");

describe("formatCurrency", () => {
  test("formats a number as Brazilian currency with two decimals", () => {
    expect(normalize(formatCurrency(12.5))).toBe("R$ 12,50");
  });

  test("keeps two decimals for a whole value, which the API no longer pads", () => {
    expect(normalize(formatCurrency(65))).toBe("R$ 65,00");
  });

  test("groups thousands", () => {
    expect(normalize(formatCurrency(1234.5))).toBe("R$ 1.234,50");
  });
});

describe("formatQuantity", () => {
  test("formats a whole quantity without decimals", () => {
    expect(normalize(formatQuantity(2000))).toBe("2.000");
  });

  test("keeps up to three decimals", () => {
    expect(normalize(formatQuantity(1.5))).toBe("1,5");
  });
});
