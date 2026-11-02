import { z } from "zod";
import { PUBLIC } from "@/server/modules/auth/auth.access";
import type { Route } from "./route";

type JsonSchema = Record<string, unknown>;

const toSchema = (schema: z.ZodType, io: "input" | "output"): JsonSchema => {
  const { $schema: _dropped, ...rest } = z.toJSONSchema(schema, { target: "openapi-3.0", io, unrepresentable: "any" });

  return rest;
};

/** One `in: path` or `in: query` parameter per property of an object schema. */
function parametersOf(schema: z.ZodType | undefined, location: "path" | "query"): JsonSchema[] {
  if (schema === undefined) return [];

  const object = toSchema(schema, "input");
  const properties = (object.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((object.required ?? []) as string[]);

  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || required.has(name),
    schema: property,
  }));
}

function responsesOf(route: Route): Record<string, JsonSchema> {
  return Object.fromEntries(
    Object.entries(route.response).map(([status, schema]) => {
      const body = toSchema(schema!, "output");
      // A `void` response has no body, as a 204 does.
      const hasBody = Object.keys(body).length > 0 && body.not === undefined;

      return [
        status,
        hasBody
          ? { description: "Default Response", content: { "application/json": { schema: body } } }
          : { description: "Default Response" },
      ];
    }),
  );
}

/** The paths of the document use `{name}` where a route pattern uses `:name`. */
const openApiPathOf = (prefix: string, path: string) => `${prefix}${path.replace(/:(\w+)/g, "{$1}")}`;

/**
 * The OpenAPI document of a route table. It is what the mobile client and the front end generate
 * their types from, so each route's path, schemas and status codes come from the same declarations
 * the dispatcher enforces.
 */
export function buildOpenApiDocument(routes: Route[], prefix: string): JsonSchema {
  const paths: Record<string, Record<string, JsonSchema>> = {};

  for (const route of routes) {
    const operation: JsonSchema = {
      tags: route.tags,
      summary: route.summary,
      ...(route.auth === PUBLIC ? {} : { security: [{ BearerAuth: [] }] }),
    };
    const parameters = [...parametersOf(route.params, "path"), ...parametersOf(route.querystring, "query")];

    if (parameters.length > 0) operation.parameters = parameters;
    if (route.body !== undefined) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: toSchema(route.body, "input") } },
      };
    }
    operation.responses = responsesOf(route);

    const path = openApiPathOf(prefix, route.path);

    paths[path] = { ...paths[path], [route.method.toLowerCase()]: operation };
  }

  return {
    openapi: "3.0.3",
    info: { title: "wa-api", description: "Backend para o wa-system", version: "0.0.0" },
    components: {
      securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths,
  };
}
