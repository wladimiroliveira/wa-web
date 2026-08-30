import { describe, expect, it } from "vitest";
import { messageForError } from "@/lib/form-errors";
import { ApiError, SessionExpiredError } from "@/lib/http";

describe("messageForError", () => {
  it("prefers the caller's wording for a status it knows the meaning of", () => {
    expect(messageForError(new ApiError(409, null), { 409: "Já existe um papel com esse nome." })).toBe(
      "Já existe um papel com esse nome.",
    );
  });

  it("explains an unreachable API instead of blaming the operator", () => {
    expect(messageForError(new ApiError(0, null))).toBe(
      "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    );
  });

  it("says the session ended, which is not the same as an operation that failed", () => {
    expect(messageForError(new SessionExpiredError())).toBe("Sua sessão expirou. Entre novamente.");
  });

  it("never leaks the API's own English message to the screen", () => {
    const message = messageForError(new ApiError(500, { message: "Something exploded." }));

    expect(message).not.toContain("Something exploded.");
    expect(message).toBe("Não foi possível concluir a operação. Tente de novo.");
  });

  it("survives something that is not an ApiError at all", () => {
    expect(messageForError(new TypeError("boom"))).toBe("Não foi possível concluir a operação. Tente de novo.");
  });
});
