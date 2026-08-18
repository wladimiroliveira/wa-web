import type { Supply } from "@/features/supplies/supplies.api";

/**
 * Exhaustive on purpose: a supply type added to the API makes tsc fail here
 * until someone writes the Portuguese label.
 */
export const SUPPLY_TYPE_LABELS: Record<Supply["type"], string> = {
  INGREDIENT: "Ingrediente",
  PACKAGING: "Embalagem",
};
