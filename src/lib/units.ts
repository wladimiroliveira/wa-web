import type { MeasurementUnit } from "@/lib/api";

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  UNIT: "un",
  KILOGRAM: "kg",
  GRAM: "g",
  LITER: "L",
  MILLILITER: "mL",
};

export function unitLabel(unit: MeasurementUnit): string {
  return UNIT_LABELS[unit];
}
