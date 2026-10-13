import type { StockMovementType } from "@/lib/api";

// The API stores every quantity as a positive number; the type is what says whether
// it came into the stock or left it.
const MOVEMENT_TYPES: Record<StockMovementType, { label: string; sign: "+" | "−" }> = {
  ENTRY: { label: "Entrada", sign: "+" },
  PRODUCTION_CONSUMPTION: { label: "Consumo na produção", sign: "−" },
  PRODUCTION_OUTPUT: { label: "Produção", sign: "+" },
};

export function movementLabel(type: StockMovementType): string {
  return MOVEMENT_TYPES[type].label;
}

export function movementSign(type: StockMovementType): string {
  return MOVEMENT_TYPES[type].sign;
}
