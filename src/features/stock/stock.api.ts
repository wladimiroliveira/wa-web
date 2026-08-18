import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type MovementPage = paths["/supplies/{id}/movements"]["get"]["responses"][200]["content"]["application/json"];
export type Movement = MovementPage["data"][number];
export type CreateStockEntryInput =
  paths["/supplies/{id}/stock-entries"]["post"]["requestBody"]["content"]["application/json"];
export type StockEntryResult =
  paths["/supplies/{id}/stock-entries"]["post"]["responses"][201]["content"]["application/json"];

/** The ledger is append-only and paginated by cursor, newest first. */
export function fetchMovements(supplyId: string, cursor?: string): Promise<MovementPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<MovementPage>(`/supplies/${supplyId}/movements${query}`);
}

export function createStockEntry(supplyId: string, input: CreateStockEntryInput): Promise<StockEntryResult> {
  return request<StockEntryResult>(`/supplies/${supplyId}/stock-entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
