import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.url({ protocol: /^https?$/ }),
});

export interface Env {
  apiUrl: string;
}

/**
 * Fails loudly instead of letting an undefined base URL turn into
 * `fetch("undefined/sessions")`, which surfaces as a confusing network error
 * far away from the actual cause.
 */
export function readEnv(source: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${details}`);
  }

  return { apiUrl: parsed.data.VITE_API_URL.replace(/\/$/, "") };
}

export const env = readEnv(import.meta.env);
