import type { z } from "zod";
import type { Permission } from "@prisma/client";
import type { AccessRule, AuthenticatedUserLoader } from "@/server/modules/auth/auth.access";
import { AUTHENTICATED, PUBLIC } from "@/server/modules/auth/auth.access";
import { verifyAccessToken, type AccessTokenOptions } from "@/server/modules/auth/auth.jwt";
import { hasPermission } from "@/server/modules/auth/auth.permissions";
import { dynamicSegmentsOf, matchPath } from "./path";
import { RateLimiter } from "./rate-limit";
import { reply, type Method, type Route, type RouteRequest, type Sent } from "./route";

export type Dispatcher = (request: Request) => Promise<Response>;

export type DispatcherOptions = {
  /** Where the routes live under the origin: `/v1`. */
  prefix: string;
  loadUser: AuthenticatedUserLoader;
  tokenOptions: () => AccessTokenOptions;
};

const METHODS: readonly Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  if (body === undefined || status === 204) return new Response(null, { status, headers });

  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

const unauthorized = () => json(401, { message: "Authentication required." });
const forbidden = () => json(403, { message: "Permission denied." });

const badRequest = (message: string) => json(400, { statusCode: 400, error: "Bad Request", message });

const validationMessage = (where: string, error: z.ZodError) =>
  `${where}/${error.issues.map((issue) => `${issue.path.join("/")} ${issue.message}`).join(", ")}`;

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (header === null || !header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();

  return token === "" ? null : token;
}

/** The address the request came from: the first hop the proxy recorded, or the socket when there is none. */
function ipOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || "127.0.0.1";
}

/** A parameter repeated in the query string arrives as an array, one written once as a string. */
function queryOf(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams) {
    const current = query[key];

    query[key] = current === undefined ? value : [current, value].flat();
  }

  return query;
}

type ParsedBody = { ok: true; body: unknown } | { ok: false; response: Response };

async function bodyOf(request: Request): Promise<ParsedBody> {
  const text = await request.text();

  if (text === "") return { ok: true, body: undefined };

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: badRequest("Body is not valid JSON.") };
  }
}

function serialize(route: Route, sent: Sent): Response {
  const schema = route.response[sent.status];

  if (schema === undefined) return json(sent.status, sent.body);

  // Serializing through the declared schema is what keeps a field nobody declared from leaking,
  // the way the previous API's serializer did.
  const result = schema.safeParse(sent.body);

  if (!result.success) {
    console.error(`Response of ${route.method} ${route.path} does not match its schema`, result.error.issues);

    return json(500, {
      statusCode: 500,
      error: "Internal Server Error",
      message: "Response does not match its schema.",
    });
  }

  return json(sent.status, result.data);
}

/** Builds the function that answers one request from the route table: match, authorize, validate, run, serialize. */
export function createDispatcher(routes: Route[], options: DispatcherOptions): Dispatcher {
  const limiter = new RateLimiter();

  function findRoute(method: Method, pathname: string): { route: Route; params: Record<string, string> } | null {
    const matches = routes
      .filter((route) => route.method === method)
      .flatMap((route) => {
        const params = matchPath(route.path, pathname);

        return params === null ? [] : [{ route, params }];
      })
      .sort((a, b) => dynamicSegmentsOf(a.route.path) - dynamicSegmentsOf(b.route.path));

    return matches[0] ?? null;
  }

  async function authorize(
    request: Request,
    rule: AccessRule,
  ): Promise<{ user?: RouteRequest<never, never, never>["currentUser"] } | Response> {
    if (rule === PUBLIC) return {};

    const token = bearerToken(request);

    if (token === null) return unauthorized();

    const payload = await verifyAccessToken(options.tokenOptions(), token);

    if (payload === null) return unauthorized();

    const user = await options.loadUser(payload.sub);

    if (user === null) return unauthorized();

    if (rule !== AUTHENTICATED && !hasPermission(user.permissions, rule as Permission)) return forbidden();

    return { user };
  }

  return async function dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // HEAD answers like GET without the body, as any HTTP server does.
    const method = (request.method === "HEAD" ? "GET" : request.method) as Method;
    const pathname = url.pathname.startsWith(options.prefix) ? url.pathname.slice(options.prefix.length) || "/" : null;
    const found = pathname !== null && METHODS.includes(method) ? findRoute(method, pathname) : null;

    if (found === null) {
      return json(404, {
        message: `Route ${request.method}:${url.pathname} not found`,
        error: "Not Found",
        statusCode: 404,
      });
    }

    const { route, params } = found;

    try {
      const access = await authorize(request, route.auth);

      if (access instanceof Response) return access;

      const parsedParams = route.params?.safeParse(params);

      if (parsedParams?.success === false) return badRequest(validationMessage("params", parsedParams.error));

      const parsedQuery = route.querystring?.safeParse(queryOf(url));

      if (parsedQuery?.success === false) return badRequest(validationMessage("querystring", parsedQuery.error));

      const raw = method === "GET" ? { ok: true as const, body: undefined } : await bodyOf(request);

      if (!raw.ok) return raw.response;

      const parsedBody = route.body?.safeParse(raw.body);

      if (parsedBody?.success === false) return badRequest(validationMessage("body", parsedBody.error));

      const routeRequest: RouteRequest<unknown, unknown, unknown> = {
        params: parsedParams?.data,
        query: parsedQuery?.data,
        body: parsedBody?.data,
        currentUser: access.user,
        ip: ipOf(request),
        headers: request.headers,
      };

      if (route.rateLimit !== undefined) {
        const budget = limiter.consume(route.rateLimit.keyGenerator(routeRequest), route.rateLimit);

        if (!budget.allowed) {
          const retryAfter = Math.ceil(budget.retryAfterMs / 1000);

          return json(
            429,
            {
              statusCode: 429,
              error: "Too Many Requests",
              message: `Rate limit exceeded, retry in ${retryAfter} seconds`,
            },
            { "retry-after": String(retryAfter) },
          );
        }
      }

      const response = serialize(route, await route.handler(routeRequest, reply));

      return request.method === "HEAD"
        ? new Response(null, { status: response.status, headers: response.headers })
        : response;
    } catch (error) {
      console.error(`Unhandled error in ${route.method} ${route.path}`, error);

      return json(500, { statusCode: 500, error: "Internal Server Error", message: "Internal server error." });
    }
  };
}
