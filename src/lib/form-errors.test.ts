import { describe, expect, test } from "vitest";
import { isFormError } from "@/lib/form-errors";
import { ApiError, SessionExpiredError } from "@/lib/http";

describe("isFormError", () => {
  test.each([400, 409, 422])("is a form error for %i, a status a form field can fix", (status) => {
    expect(isFormError(new ApiError(status, "Erro"))).toBe(true);
  });

  test.each([401, 403, 404, 429, 500, 502])(
    "is not a form error for %i — a status a form field cannot fix",
    (status) => {
      expect(isFormError(new ApiError(status, "Erro"))).toBe(false);
    },
  );

  test("a SessionExpiredError is a 401 and is routed away from the form even though it is an ApiError", () => {
    expect(isFormError(new SessionExpiredError())).toBe(false);
  });

  test("a non-ApiError is never a form error", () => {
    expect(isFormError(new Error("network down"))).toBe(false);
    expect(isFormError("not even an error")).toBe(false);
  });
});
