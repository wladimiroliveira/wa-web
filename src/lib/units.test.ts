import { describe, expect, it } from "vitest";
import { unitLabel } from "@/lib/units";

describe("unitLabel", () => {
  it("abbreviates a measurement unit the way the shop floor writes it", () => {
    expect(unitLabel("KILOGRAM")).toBe("kg");
    expect(unitLabel("UNIT")).toBe("un");
  });
});
