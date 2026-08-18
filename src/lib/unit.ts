import type { paths } from "@/lib/api.types";
import { formatQuantity } from "@/lib/format";

/**
 * Derived from the contract rather than retyped, so a unit added to the API
 * makes tsc fail on the `Record` below until someone gives it a factor.
 */
export type Unit = paths["/supplies"]["post"]["requestBody"]["content"]["application/json"]["purchaseUnit"];

export type Dimension = "WEIGHT" | "VOLUME" | "COUNT";

interface UnitMetadata {
  dimension: Dimension;
  /** What the API multiplies by to reach the base unit of the dimension. */
  factorToBase: number;
  /** What the screen prints after the number. */
  label: string;
}

/**
 * Mirrors `UNIT_METADATA` in the wa-api. It is deliberate duplication of five
 * lines: the alternative is showing the raw base, which reads as 12500 for a
 * balance of 12,5 kg.
 */
export const UNIT_METADATA: Record<Unit, UnitMetadata> = {
  G: { dimension: "WEIGHT", factorToBase: 1, label: "g" },
  KG: { dimension: "WEIGHT", factorToBase: 1000, label: "kg" },
  ML: { dimension: "VOLUME", factorToBase: 1, label: "ml" },
  L: { dimension: "VOLUME", factorToBase: 1000, label: "l" },
  UN: { dimension: "COUNT", factorToBase: 1, label: "un" },
};

export const ALL_UNITS = Object.keys(UNIT_METADATA) as Unit[];

/**
 * Read-only conversion. There is no `toBase` on purpose: the API takes
 * `quantity` and `unit` raw and converts with `Prisma.Decimal`, so multiplying
 * here would reintroduce floating-point noise on a path that is exact today.
 */
export function fromBase(base: number, unit: Unit): number {
  return base / UNIT_METADATA[unit].factorToBase;
}

export function unitsOfDimension(unit: Unit): Unit[] {
  const { dimension } = UNIT_METADATA[unit];
  return ALL_UNITS.filter((candidate) => UNIT_METADATA[candidate].dimension === dimension);
}

export function unitLabel(unit: Unit): string {
  return UNIT_METADATA[unit].label;
}

/** For a value already expressed in `unit` — a purchase quantity, a form input. */
export function formatWithUnit(value: number, unit: Unit): string {
  return `${formatQuantity(value)} ${unitLabel(unit)}`;
}

/** For a value the API stores in the base unit — a balance, a movement. */
export function formatInUnit(base: number, unit: Unit): string {
  return formatWithUnit(fromBase(base, unit), unit);
}
