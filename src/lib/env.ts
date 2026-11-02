import { z } from "zod";

// The API is served by this same application under `/v1`, so the base url is normally a path
// relative to the origin. It can still be pointed at another host while the API runs elsewhere.
//
// `z.url()` alone delegates to the WHATWG parser, which reads `localhost:3333` as scheme
// `localhost` and accepts it — and accepts `ftp://` too. Pinning the protocol is what makes
// the common misconfiguration, a base url written with no scheme, fail at boot instead of at
// the first request.
const baseUrlSchema = z.union([z.url({ protocol: /^https?$/ }), z.string().regex(/^\/[^\s]*$/)]);

const envSchema = z.object({
  // An empty value is what `.example.env` ships with, and means "same origin".
  NEXT_PUBLIC_API_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), baseUrlSchema.default("/v1")),
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

  return { apiUrl: result.data.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "") };
}

// Spelled out in full: Next inlines a public variable into the browser bundle only where it
// is read by its literal name.
export const env = parseEnv({ NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL });
