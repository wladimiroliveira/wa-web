import type { CreateLossBody, CreateLossReasonBody, Loss, LossReason, UpdateLossReasonBody } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for the reasons' cache entry, shared by the screen that manages them and the one that uses them. */
export const lossReasonsKeys = {
  all: ["loss-reasons"] as const,
};

export function fetchLossReasons(): Promise<LossReason[]> {
  return request<LossReason[]>("/loss-reasons");
}

export function createLossReason(body: CreateLossReasonBody): Promise<LossReason> {
  return request<LossReason>("/loss-reasons", { method: "POST", body: JSON.stringify(body) });
}

export function updateLossReason(id: string, body: UpdateLossReasonBody): Promise<LossReason> {
  return request<LossReason>(`/loss-reasons/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function createLoss(body: CreateLossBody): Promise<Loss> {
  return request<Loss>("/losses", { method: "POST", body: JSON.stringify(body) });
}
