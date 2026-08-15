import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, test } from "vitest";
import { ApiError, SessionExpiredError } from "@/lib/http";
import { createQueryClient } from "@/lib/query";
import { clearSession, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";

beforeEach(() => {
  clearSession();
});

async function failQuery(client: QueryClient, error: Error): Promise<void> {
  await client.fetchQuery({ queryKey: ["supplies"], queryFn: () => Promise.reject(error) }).catch(() => undefined);
}

describe("createQueryClient", () => {
  test("ends the session when any query — not only /me — dies of an expired session", async () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");
    const client = createQueryClient();
    client.setQueryData(["me"], { id: "u1" });

    await failQuery(client, new SessionExpiredError());

    expect(getRefreshToken()).toBeNull();
    expect(client.getQueryData(["me"])).toBeUndefined();
  });

  test("leaves the session untouched when a query fails for any other reason", async () => {
    setAccessToken("access-1");
    setRefreshToken("refresh-1");
    const client = createQueryClient();
    client.setQueryData(["me"], { id: "u1" });

    await failQuery(client, new ApiError(500, "Erro interno"));

    expect(getRefreshToken()).toBe("refresh-1");
    expect(client.getQueryData(["me"])).toEqual({ id: "u1" });
  });
});
