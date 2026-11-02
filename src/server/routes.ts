import { z } from "zod";
import { buildOpenApiDocument } from "@/server/http/openapi";
import { route, type Route } from "@/server/http/route";
import { API_PREFIX } from "@/server/lib/api-version";
import { PUBLIC } from "@/server/modules/auth/auth.access";
import { authRoutes } from "@/server/modules/auth/auth.routes";

const healthRoute = route({
  method: "GET",
  path: "/health",
  auth: PUBLIC,
  tags: ["health"],
  summary: "Saúde do serviço",
  response: { 200: z.object({ status: z.string() }) },
  handler: async (_request, reply) => reply.send({ status: "ok" }),
});

// The document describes the table it is part of, so a client can read it from the running
// service as well as from the checked-in file.
const openApiRoute = route({
  method: "GET",
  path: "/openapi.json",
  auth: PUBLIC,
  tags: ["docs"],
  summary: "Documento OpenAPI desta API",
  response: { 200: z.record(z.string(), z.unknown()) },
  handler: async (_request, reply) => reply.send(buildOpenApiDocument(routes, API_PREFIX)),
});

/** Every route of the API, in the order the modules were added. */
export const routes: Route[] = [healthRoute, openApiRoute, ...authRoutes];
