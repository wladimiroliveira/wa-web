import { describe, expect, test } from "vitest";
import { fromPercent, toPercent } from "@/features/recipes/margin";

describe("margin", () => {
  // `0.35 * 100` is 35.000000000000004 in JavaScript. A field that opens with
  // that value is wrong on its face, so multiplying is what needs rounding.
  test("toPercent converts the fraction without a floating-point tail", () => {
    expect(toPercent(0.35)).toBe(35);
    expect(toPercent(0.1)).toBe(10);
    expect(toPercent(0.07)).toBe(7);
  });

  test("toPercent keeps one decimal place", () => {
    expect(toPercent(0.335)).toBe(33.5);
  });

  test("the two are inverses over the values the screen produces", () => {
    for (const fraction of [0, 0.05, 0.35, 1, 1.5]) {
      expect(fromPercent(toPercent(fraction))).toBe(fraction);
    }
  });

  // What travels to the API is the serialized number, so that is what the test
  // asserts: dividing lands on the nearest double to 0.35, which prints as 0.35.
  test("fromPercent serializes as the fraction the API expects", () => {
    expect(JSON.stringify(fromPercent(35))).toBe("0.35");
    expect(JSON.stringify(fromPercent(0))).toBe("0");
  });
});
