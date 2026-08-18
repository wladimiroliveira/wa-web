import type { Movement } from "@/features/stock/stock.api";

/**
 * Exhaustive on purpose: a movement type added to the API makes tsc fail here
 * until someone writes the Portuguese label.
 */
export const MOVEMENT_TYPE_LABELS: Record<Movement["type"], string> = {
  ENTRY: "Entrada",
  PRODUCTION: "Produção",
  WASTE: "Perda",
};
