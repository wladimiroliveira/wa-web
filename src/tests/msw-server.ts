import { setupServer } from "msw/node";
import { env } from "@/lib/env";

export const server = setupServer();

/** Builds an absolute URL for a handler, from the same base the client uses. */
export function apiUrl(path: string): string {
  return `${env.apiUrl}${path}`;
}
