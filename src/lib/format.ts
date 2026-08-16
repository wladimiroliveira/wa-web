/**
 * The API returns decimals as `number` since the response-schema layer, and it
 * dropped the `toFixed(2)` it used to apply to prices. Formatting is ours now.
 */
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const quantityFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}

/** The API sends ISO timestamps; the ledger reads better as a plain date. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
