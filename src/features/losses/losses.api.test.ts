import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createLoss,
  createLossReason,
  fetchLossReasons,
  lossReasonsKeys,
  updateLossReason,
} from "@/features/losses/losses.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aLoss, aLossReason } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

/** Answers with `response` and hands back what the request carried. */
function capturing(method: "post" | "patch", path: string, response: object) {
  const received: { body: unknown } = { body: null };
  server.use(
    http[method](apiUrl(path), async ({ request: incoming }) => {
      received.body = await incoming.json();
      return HttpResponse.json(response, { status: method === "post" ? 201 : 200 });
    }),
  );

  return received;
}

describe("losses api", () => {
  it("names the cache entry the reasons share", () => {
    expect(lossReasonsKeys.all).toEqual(["loss-reasons"]);
  });

  it("lists the reasons", async () => {
    server.use(http.get(apiUrl("/loss-reasons"), () => HttpResponse.json([aLossReason()])));

    await expect(fetchLossReasons()).resolves.toEqual([aLossReason()]);
  });

  it("registers a reason", async () => {
    const received = capturing("post", "/loss-reasons", aLossReason());

    await expect(createLossReason({ name: "Vencimento" })).resolves.toEqual(aLossReason());
    expect(received.body).toEqual({ name: "Vencimento" });
  });

  it("edits a reason by id", async () => {
    const received = capturing("patch", "/loss-reasons/reason-1", aLossReason({ isActive: false }));

    await updateLossReason("reason-1", { isActive: false });

    expect(received.body).toEqual({ isActive: false });
  });

  it("records a loss", async () => {
    const body = { lotId: "lot-1", reasonId: "reason-1", quantity: "2.5" };
    const received = capturing("post", "/losses", aLoss());

    await expect(createLoss(body)).resolves.toEqual(aLoss());
    expect(received.body).toEqual(body);
  });
});
