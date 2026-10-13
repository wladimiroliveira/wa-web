import type { CreateEntryBody, Entry } from "@/lib/api";
import { request } from "@/lib/http";

export function createEntry(body: CreateEntryBody): Promise<Entry> {
  return request<Entry>("/entries", { method: "POST", body: JSON.stringify(body) });
}
