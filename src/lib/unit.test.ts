import { describe, expect, test } from "vitest";
import {
  ALL_UNITS,
  formatInUnit,
  formatWithUnit,
  fromBase,
  UNIT_METADATA,
  unitLabel,
  unitsOfDimension,
} from "@/lib/unit";

describe("fromBase", () => {
  test("divides by the factor of the target unit", () => {
    expect(fromBase(12500, "KG")).toBe(12.5);
    expect(fromBase(750, "L")).toBe(0.75);
  });

  test("returns the base untouched for the units whose factor is 1", () => {
    expect(fromBase(300, "G")).toBe(300);
    expect(fromBase(750, "ML")).toBe(750);
    expect(fromBase(40, "UN")).toBe(40);
  });

  // A production may consume more than there is: the API records it and warns
  // instead of refusing, so a negative balance is a state the screen must show.
  test("keeps the sign of a negative balance", () => {
    expect(fromBase(-1200, "KG")).toBe(-1.2);
  });
});

describe("unitsOfDimension", () => {
  test("offers only the units of the same dimension, including the one asked for", () => {
    expect(unitsOfDimension("KG")).toEqual(["G", "KG"]);
    expect(unitsOfDimension("ML")).toEqual(["ML", "L"]);
    expect(unitsOfDimension("UN")).toEqual(["UN"]);
  });
});

describe("formatting", () => {
  test("formatWithUnit does not convert — the value is already in the unit", () => {
    expect(formatWithUnit(5, "KG")).toBe("5 kg");
  });

  test("formatInUnit converts from the base and labels the unit", () => {
    expect(formatInUnit(12500, "KG")).toBe("12,5 kg");
    expect(formatInUnit(40, "UN")).toBe("40 un");
  });

  test("caps at three decimals, as formatQuantity does", () => {
    expect(formatInUnit(1, "KG")).toBe("0,001 kg");
  });

  test("unitLabel is the lowercase abbreviation the screen shows", () => {
    expect(ALL_UNITS.map(unitLabel)).toEqual(["g", "kg", "ml", "l", "un"]);
  });
});

// The metadata mirrors a table in the wa-api. A unit added there must not reach
// the screen without a dimension and a factor, and `Record<Unit, …>` is what
// makes tsc refuse a partial one. This asserts the runtime half of that.
describe("the metadata mirrors the API", () => {
  test("every unit has a dimension and a factor, and ALL_UNITS is the record's keys", () => {
    expect(ALL_UNITS).toEqual(["G", "KG", "ML", "L", "UN"]);

    for (const unit of ALL_UNITS) {
      expect(UNIT_METADATA[unit].factorToBase).toBeGreaterThan(0);
      expect(["WEIGHT", "VOLUME", "COUNT"]).toContain(UNIT_METADATA[unit].dimension);
    }
  });

  test("each dimension has exactly one base unit, the one whose factor is 1", () => {
    const bases = ALL_UNITS.filter((unit) => UNIT_METADATA[unit].factorToBase === 1);

    expect(bases).toEqual(["G", "ML", "UN"]);
  });
});
