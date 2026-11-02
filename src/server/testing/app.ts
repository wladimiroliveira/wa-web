import { Permission } from "@prisma/client";
import { buildApp } from "@/server/app";
import { hashPassword } from "@/server/modules/auth/auth.password";
import { testPrisma } from "./database";

export type InjectOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  url: string;
  /** An object is sent as JSON; a string goes as it is, for a test about a body that is not JSON. */
  payload?: unknown;
  headers?: Record<string, string>;
};

export type InjectResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  json<T = any>(): T;
};

/** The API under test, called in memory the way the route handler calls it: no port, no network. */
export type TestApp = {
  inject(options: InjectOptions): Promise<InjectResponse>;
  close(): Promise<void>;
};

export async function startTestApp(): Promise<TestApp> {
  const app = buildApp();

  return {
    async inject({ method, url, payload, headers = {} }) {
      const body = payload === undefined ? undefined : typeof payload === "string" ? payload : JSON.stringify(payload);
      const request = new Request(`http://localhost${url}`, {
        method,
        headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
        body,
      });
      const response = await app(request);
      const text = await response.text();

      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers),
        body: text,
        json: () => JSON.parse(text),
      };
    },
    close: async () => {},
  };
}

// Creates a user holding exactly the permissions the test needs and logs in as that user. Tests
// that need a permission say so; nothing is granted by accident.
export async function authenticateAs(
  app: TestApp,
  permissions: Permission[],
  username = "tester",
): Promise<{ userId: string; headers: { authorization: string } }> {
  const user = await testPrisma.user.create({
    data: {
      name: "Test Person",
      username,
      passwordHash: await hashPassword("correct horse battery"),
      extraPermissions: permissions,
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/sessions/signin",
    payload: { username, password: "correct horse battery" },
  });

  return { userId: user.id, headers: { authorization: `Bearer ${response.json().accessToken}` } };
}
