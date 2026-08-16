import { ApiError } from "@/lib/http";

/** Statuses the API returns for a submission a person can fix by editing the form. */
const FORM_FIXABLE_STATUSES = [400, 409, 422];

/**
 * The shared mutation error-routing rule: what a person can fix by editing
 * the form — a validation error or a conflict the API rejected the
 * submission for — stays in the form. Everything else, including 401/403/404
 * and every 5xx or network failure, is not the form's problem to display, so
 * it is not a form error at all — it goes to a toast instead.
 *
 * This is an allowlist, not a "not a 5xx" blocklist, on purpose:
 * `SessionExpiredError` extends `ApiError` with status 401, and a blanket
 * `4xx` check would treat an expired session as a fixable form error.
 */
export function isFormError(error: unknown): error is ApiError {
  return error instanceof ApiError && FORM_FIXABLE_STATUSES.includes(error.status);
}
