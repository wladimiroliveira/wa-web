import { ApiError, SessionExpiredError } from "@/lib/http";

const UNREACHABLE = "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";
const EXPIRED = "Sua sessão expirou. Entre novamente.";
const FALLBACK = "Não foi possível concluir a operação. Tente de novo.";

/**
 * The API answers in English and the interface is in Portuguese, so its message
 * never reaches the screen. The caller supplies the wording for the statuses it
 * knows the meaning of in its own context; everything else falls back to a
 * sentence that is honest without pretending to explain.
 */
export function messageForError(error: unknown, byStatus: Partial<Record<number, string>> = {}): string {
  if (!(error instanceof ApiError)) return FALLBACK;
  if (error instanceof SessionExpiredError) return EXPIRED;

  const known = byStatus[error.status];
  if (known !== undefined) return known;

  return error.status === 0 ? UNREACHABLE : FALLBACK;
}
