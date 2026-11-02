import { Permission } from "@prisma/client";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createDispatcher } from "@/server/http/dispatch";
import { route, type Route } from "@/server/http/route";
import { AUTHENTICATED, PUBLIC, type AuthenticatedUser } from "@/server/modules/auth/auth.access";
import { signAccessToken } from "@/server/modules/auth/auth.jwt";

const TOKEN_OPTIONS = { secret: "a-secret-long-enough-to-be-taken-seriously", ttlMinutes: 15 };
const USER: AuthenticatedUser = { id: "0199a1f0-0000-7000-8000-000000000001", permissions: [Permission.SALES_READ] };

const ok = route({
  method: "GET",
  path: "/ok",
  auth: PUBLIC,
  tags: [],
  summary: "",
  response: { 200: z.object({ ok: z.boolean() }) },
  handler: async (_request, reply) => reply.send({ ok: true, secret: "never sent" } as { ok: boolean }),
});

const me = route({
  method: "GET",
  path: "/me",
  auth: AUTHENTICATED,
  tags: [],
  summary: "",
  response: { 200: z.object({ id: z.string() }) },
  handler: async (request, reply) => reply.send({ id: request.currentUser!.id }),
});

const sales = route({
  method: "GET",
  path: "/sales",
  auth: Permission.SALES_READ,
  tags: [],
  summary: "",
  response: { 200: z.object({ ok: z.boolean() }) },
  handler: async (_request, reply) => reply.send({ ok: true }),
});

const reports = route({ ...sales, path: "/reports", auth: Permission.REPORTS_READ } as Route);

const echo = route({
  method: "POST",
  path: "/things/:id",
  auth: PUBLIC,
  tags: [],
  summary: "",
  params: z.object({ id: z.uuid() }),
  querystring: z.object({
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    n: z.coerce.number().optional(),
  }),
  body: z.object({ name: z.string().min(1) }),
  response: {
    201: z.object({ id: z.string(), name: z.string(), tag: z.unknown(), n: z.number().optional() }),
    204: z.void(),
  },
  handler: async (request, reply) => {
    if (request.body.name === "nothing") return reply.code(204).send();

    return reply
      .code(201)
      .send({ id: request.params.id, name: request.body.name, tag: request.query.tag, n: request.query.n });
  },
});

const plan = route({ ...ok, path: "/things/plan" } as Route);
const thing = route({
  ...ok,
  path: "/things/:id",
  handler: async (request, reply) => reply.send({ ok: false, ...(request.params as object) }),
} as Route);

const limited = route({
  method: "POST",
  path: "/limited",
  auth: PUBLIC,
  tags: [],
  summary: "",
  body: z.object({ who: z.string() }),
  rateLimit: { max: 2, timeWindowMs: 60_000, keyGenerator: (request) => (request.body as { who: string }).who },
  response: { 200: z.object({ ok: z.boolean() }) },
  handler: async (_request, reply) => reply.send({ ok: true }),
});

const broken = route({
  ...ok,
  path: "/broken",
  handler: async () => {
    throw new Error("boom");
  },
} as Route);

const dispatch = createDispatcher([ok, me, sales, reports, echo, plan, thing, limited, broken], {
  prefix: "/v1",
  loadUser: async (userId) => (userId === USER.id ? USER : null),
  tokenOptions: () => TOKEN_OPTIONS,
});

const ID = "0199a1f0-0000-7000-8000-000000000002";

const call = (method: string, url: string, init: { body?: unknown; headers?: Record<string, string> } = {}) =>
  dispatch(
    new Request(`http://localhost${url}`, {
      method,
      headers: { "content-type": "application/json", ...init.headers },
      body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    }),
  );

const bearer = async (userId = USER.id) => ({
  authorization: `Bearer ${await signAccessToken(TOKEN_OPTIONS, userId)}`,
});

describe("dispatch", () => {
  it("answers 404 for a path or a method nobody declared", async () => {
    expect((await call("GET", "/v1/nowhere")).status).toBe(404);
    expect((await call("DELETE", "/v1/ok")).status).toBe(404);
    expect((await call("GET", "/ok")).status).toBe(404);
  });

  it("serializes the answer through the declared schema, dropping what it does not name", async () => {
    const response = await call("GET", "/v1/ok");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("answers HEAD like GET, without the body", async () => {
    const response = await call("HEAD", "/v1/ok");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("prefers a static segment to a dynamic one", async () => {
    expect(await (await call("GET", "/v1/things/plan")).json()).toEqual({ ok: true });
    expect(await (await call("GET", `/v1/things/${ID}`)).json()).toEqual({ ok: false });
  });

  it("hands the handler its params, query and body as their schemas read them", async () => {
    const response = await call("POST", `/v1/things/${ID}?tag=a&tag=b&n=3`, { body: { name: "x" } });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ID, name: "x", tag: ["a", "b"], n: 3 });
  });

  it("sends a 204 with no body", async () => {
    const response = await call("POST", `/v1/things/${ID}`, { body: { name: "nothing" } });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it.each([
    ["params", `/v1/things/not-a-uuid`, { name: "x" }],
    ["querystring", `/v1/things/${ID}?n=abc`, { name: "x" }],
    ["body", `/v1/things/${ID}`, { name: "" }],
    ["a body that is not JSON", `/v1/things/${ID}`, "{oops"],
  ])("answers 400 for invalid %s", async (_label, url, body) => {
    const response = await call("POST", url, { body });

    expect(response.status).toBe(400);
    expect((await response.json()).statusCode).toBe(400);
  });

  it("answers 401 when an authenticated route gets no token, a bad one, or one of nobody", async () => {
    expect((await call("GET", "/v1/me")).status).toBe(401);
    expect((await call("GET", "/v1/me", { headers: { authorization: "Bearer nonsense" } })).status).toBe(401);
    expect((await call("GET", "/v1/me", { headers: await bearer(ID) })).status).toBe(401);
  });

  it("tells the handler who is calling", async () => {
    const response = await call("GET", "/v1/me", { headers: await bearer() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: USER.id });
  });

  it("answers 403 for a permission the user lacks, and 200 for one they hold", async () => {
    expect((await call("GET", "/v1/reports", { headers: await bearer() })).status).toBe(403);
    expect((await call("GET", "/v1/sales", { headers: await bearer() })).status).toBe(200);
  });

  it("checks the token before validating anything", async () => {
    expect((await call("GET", "/v1/reports?x=1", { headers: {} })).status).toBe(401);
  });

  it("answers 429 once a key's attempts run out, with when to come back", async () => {
    const codes = [];

    for (let attempt = 0; attempt < 3; attempt += 1)
      codes.push((await call("POST", "/v1/limited", { body: { who: "a" } })).status);
    const other = await call("POST", "/v1/limited", { body: { who: "b" } });
    const refused = await call("POST", "/v1/limited", { body: { who: "a" } });

    expect(codes).toEqual([200, 200, 429]);
    expect(other.status).toBe(200);
    expect(refused.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("answers 500 without leaking the error when a handler throws", async () => {
    const response = await call("GET", "/v1/broken");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Internal server error.",
    });
  });
});
