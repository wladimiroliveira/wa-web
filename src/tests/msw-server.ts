import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { env } from "@/lib/env";

/** Builds an absolute URL for a handler, from the same base the client uses. */
export function apiUrl(path: string): string {
  return `${env.apiUrl}${path}`;
}

// Every list screen asks how the user arranged its columns. A test that is not about that gets a
// user who never arranged any, instead of each suite declaring it again.
const tableLayoutHandlers = [
  http.get(apiUrl("/sessions/me/table-layouts"), () => HttpResponse.json([])),
  http.put(apiUrl("/sessions/me/table-layouts/:tableKey"), async ({ params, request }) =>
    HttpResponse.json({ tableKey: params.tableKey, ...((await request.json()) as object) }),
  ),
  http.delete(apiUrl("/sessions/me/table-layouts/:tableKey"), () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...tableLayoutHandlers);
