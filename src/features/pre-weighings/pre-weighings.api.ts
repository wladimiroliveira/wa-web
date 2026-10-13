import type { CreatePreWeighingBody, PreWeighing, PreWeighingPage, PreWeighingPlan } from "@/lib/api";
import { request } from "@/lib/http";

/** What is to be produced: the quantity is in the unit of the product, as the API takes it. */
export interface PreWeighingTarget {
  productSku: string;
  quantity: string;
}

/** Everything lives under `all`; a record only makes the list stale, so that is what it invalidates. */
export const preWeighingsKeys = {
  all: ["pre-weighings"] as const,
  list: () => [...preWeighingsKeys.all, "list"] as const,
  detail: (id: string) => [...preWeighingsKeys.all, "detail", id] as const,
  plan: (target: PreWeighingTarget | null) => [...preWeighingsKeys.all, "plan", target] as const,
};

export function fetchPreWeighingPlan(target: PreWeighingTarget): Promise<PreWeighingPlan> {
  return request<PreWeighingPlan>(`/pre-weighings/plan?${new URLSearchParams({ ...target }).toString()}`);
}

export function createPreWeighing(body: CreatePreWeighingBody): Promise<PreWeighing> {
  return request<PreWeighing>("/pre-weighings", { method: "POST", body: JSON.stringify(body) });
}

export function fetchPreWeighings(query: { cursor?: string }): Promise<PreWeighingPage> {
  return request<PreWeighingPage>(
    query.cursor === undefined
      ? "/pre-weighings"
      : `/pre-weighings?${new URLSearchParams({ cursor: query.cursor }).toString()}`,
  );
}

export function fetchPreWeighing(id: string): Promise<PreWeighing> {
  return request<PreWeighing>(`/pre-weighings/${id}`);
}
