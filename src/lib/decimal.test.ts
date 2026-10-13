import { describe, expect, it } from "vitest";
import { formatDecimal, isDecimalInput, toApiDecimal, toDecimalInput } from "@/lib/decimal";

describe("decimal", () => {
  it.each(["10", "10,5", "10.5", "0,000001", "123456789012"])("accepts %s as typed by the operator", (typed) => {
    expect(isDecimalInput(typed)).toBe(true);
  });

  it.each(["", "ten", "-1", "1,0000001", "1,5,2", "1234567890123", ","])("refuses %s", (typed) => {
    expect(isDecimalInput(typed)).toBe(false);
  });

  it("sends the comma the operator typed as the point the API expects", () => {
    expect(toApiDecimal("10,5")).toBe("10.5");
    expect(toApiDecimal("10.5")).toBe("10.5");
  });

  it("writes an API decimal the way the operator would type it", () => {
    expect(toDecimalInput("10.5")).toBe("10,5");
    expect(toDecimalInput("1234")).toBe("1234");
    expect(isDecimalInput(toDecimalInput("1234.000001"))).toBe(true);
  });

  it("shows an API decimal the way it is written in Portuguese", () => {
    expect(formatDecimal("1234.5")).toBe("1.234,5");
    expect(formatDecimal("40")).toBe("40");
    expect(formatDecimal("0.000001")).toBe("0,000001");
  });

  it("keeps at least the asked number of decimal places, for money", () => {
    expect(formatDecimal("5.5", 2)).toBe("5,50");
    expect(formatDecimal("5.555", 2)).toBe("5,555");
  });
});
