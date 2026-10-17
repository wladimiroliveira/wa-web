import type { TableLayout, TableLayoutBody } from "@/lib/api";
import { request } from "@/lib/http";

/** Every table reads its layout from the same list, fetched once for the session. */
export const tableLayoutsKeys = {
  all: ["table-layouts"] as const,
};

export function fetchTableLayouts(): Promise<TableLayout[]> {
  return request<TableLayout[]>("/sessions/me/table-layouts");
}

export function saveTableLayout(tableKey: string, body: TableLayoutBody): Promise<TableLayout> {
  return request<TableLayout>(`/sessions/me/table-layouts/${tableKey}`, { method: "PUT", body: JSON.stringify(body) });
}

export function resetTableLayout(tableKey: string): Promise<void> {
  return request<void>(`/sessions/me/table-layouts/${tableKey}`, { method: "DELETE" });
}
