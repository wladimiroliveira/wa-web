import { z } from "zod";

const envSchema = z.object({
  // `z.url()` alone delegates to the WHATWG parser, which reads `localhost:3333`
  // as scheme `localhost` and accepts it — and accepts `ftp://` too. Pinning the
  // protocol is what makes the common misconfiguration, a base url written with
  // no scheme, fail at boot instead of at the first request. Same shape the
  // wa-api uses for its own DATABASE_URL.
  VITE_API_BASE_URL: z.url({ protocol: /^https?$/ }),
});

export interface Env {
  apiUrl: string;
}

// Failing here is failing at boot, with the offending variable named. An app that
// starts with an undefined base url only fails later, at the first request, as a
// network error that says nothing about its cause.
export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return { apiUrl: result.data.VITE_API_BASE_URL.replace(/\/$/, "") };
}

export const env = parseEnv(import.meta.env);
