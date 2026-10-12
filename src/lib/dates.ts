const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const TIME = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });

/** Writes an API timestamp in the operator's own timezone: `02/10/2026 09:00`. */
export function formatDateTime(iso: string): string {
  const moment = new Date(iso);

  return `${DATE.format(moment)} ${TIME.format(moment)}`;
}
