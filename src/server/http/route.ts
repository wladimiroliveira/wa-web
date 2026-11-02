import type { z } from "zod";
import type { AccessRule, AuthenticatedUser } from "@/server/modules/auth/auth.access";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** The body of each status a route may answer with, as the schema it is serialized through. */
export type ResponseSchemas = Partial<Record<number, z.ZodType>>;

/** What a handler hands back: a status and the body to serialize under that status's schema. */
export type Sent = { readonly status: number; readonly body: unknown };

type BodyOf<R extends ResponseSchemas, S extends number> = S extends keyof R
  ? NonNullable<R[S]> extends z.ZodType
    ? z.input<NonNullable<R[S]>>
    : never
  : never;

/** Builds the answer. `send` alone answers 200; `code` picks another declared status first. */
export interface Reply<R extends ResponseSchemas> {
  send(body: BodyOf<R, 200>): Sent;
  code<S extends keyof R & number>(status: S): { send(body: BodyOf<R, S>): Sent };
}

export const reply: Reply<ResponseSchemas> = {
  send: (body) => ({ status: 200, body }),
  code: (status) => ({ send: (body) => ({ status, body }) }),
};

type Parsed<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface RouteRequest<Params, Query, Body> {
  params: Params;
  query: Query;
  body: Body;
  /** Who is calling, once the access rule is anything but PUBLIC. */
  currentUser?: AuthenticatedUser;
  ip: string;
  headers: Headers;
}

export type RateLimitRule = {
  max: number;
  timeWindowMs: number;
  /** Who the budget belongs to; runs after validation, so it may read the body. */
  keyGenerator: (request: RouteRequest<unknown, unknown, unknown>) => string;
};

export interface RouteDefinition<
  Params extends z.ZodType | undefined,
  Query extends z.ZodType | undefined,
  Body extends z.ZodType | undefined,
  Responses extends ResponseSchemas,
> {
  method: Method;
  /** Relative to the API prefix, with `:name` for a dynamic segment: `/products/:sku`. */
  path: string;
  /**
   * Required, never defaulted: a route with no declared access is a route nobody decided about,
   * and the type system refusing it beats an endpoint quietly open in production.
   */
  auth: AccessRule;
  tags: string[];
  summary: string;
  params?: Params;
  querystring?: Query;
  body?: Body;
  response: Responses;
  rateLimit?: RateLimitRule;
  handler: (
    request: RouteRequest<Parsed<Params>, Parsed<Query>, Parsed<Body>>,
    reply: Reply<Responses>,
  ) => Promise<Sent> | Sent;
}

/** A route with its schemas erased, as the dispatcher and the documentation read it. */
export type Route = RouteDefinition<
  z.ZodType | undefined,
  z.ZodType | undefined,
  z.ZodType | undefined,
  ResponseSchemas
>;

/** Declares a route. It only pins the types: the handler reads params, query and body as their schemas say. */
export function route<
  Params extends z.ZodType | undefined = undefined,
  Query extends z.ZodType | undefined = undefined,
  Body extends z.ZodType | undefined = undefined,
  Responses extends ResponseSchemas = ResponseSchemas,
>(definition: RouteDefinition<Params, Query, Body, Responses>): Route {
  return definition as unknown as Route;
}
