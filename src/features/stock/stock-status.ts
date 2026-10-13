import type { StockStatus } from "@/lib/api";

type BadgeVariant = "secondary" | "destructive" | "outline";

const STOCK_STATUSES: Record<StockStatus, { label: string; badge: BadgeVariant }> = {
  NEGATIVE: { label: "Negativo", badge: "destructive" },
  EMPTY: { label: "Zerado", badge: "destructive" },
  BELOW_MINIMUM: { label: "Abaixo do mínimo", badge: "outline" },
  OK: { label: "OK", badge: "secondary" },
};

export function statusLabel(status: StockStatus): string {
  return STOCK_STATUSES[status].label;
}

export function statusBadge(status: StockStatus): BadgeVariant {
  return STOCK_STATUSES[status].badge;
}

/** Everything but a healthy balance is something the operator has to act on. */
export function needsAttention(status: StockStatus): boolean {
  return status !== "OK";
}
