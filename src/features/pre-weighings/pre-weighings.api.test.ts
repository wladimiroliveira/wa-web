import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createPreWeighing,
  fetchPreWeighing,
  fetchPreWeighingPlan,
  fetchPreWeighings,
  preWeighingsKeys,
} from "@/features/pre-weighings/pre-weighings.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aPreWeighing, aPreWeighingPlan } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("pre-weighings api", () => {
  it("names the list, each record and each plan apart, all under the feature's own", () => {
    expect(preWeighingsKeys.all).toEqual(["pre-weighings"]);
    expect(preWeighingsKeys.list()).toEqual(["pre-weighings", "list"]);
    expect(preWeighingsKeys.detail("pre-weighing-1")).toEqual(["pre-weighings", "detail", "pre-weighing-1"]);
    expect(preWeighingsKeys.plan({ productSku: "sku-1", quantity: "10" })).toEqual([
      "pre-weighings",
      "plan",
      { productSku: "sku-1", quantity: "10" },
    ]);
  });

  it("asks for the plan of a quantity of a product", async () => {
    const plan = aPreWeighingPlan();
    let params = new URLSearchParams();
    server.use(
      http.get(apiUrl("/pre-weighings/plan"), ({ request: incoming }) => {
        params = new URL(incoming.url).searchParams;
        return HttpResponse.json(plan);
      }),
    );

    await expect(fetchPreWeighingPlan({ productSku: "sku-1", quantity: "10.5" })).resolves.toEqual(plan);
    expect(Object.fromEntries(params)).toEqual({ productSku: "sku-1", quantity: "10.5" });
  });

  it("records a pre-weighing", async () => {
    const body = { productSku: "sku-1", quantity: "10", items: [{ productSku: "sku-2", weighedQuantity: "6.05" }] };
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/pre-weighings"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aPreWeighing(), { status: 201 });
      }),
    );

    await expect(createPreWeighing(body)).resolves.toEqual(aPreWeighing());
    expect(received).toEqual(body);
  });

  it("lists the first page of pre-weighings when no cursor is given", async () => {
    const page = { items: [aPreWeighing()], nextCursor: null };
    let search = "?";
    server.use(
      http.get(apiUrl("/pre-weighings"), ({ request: incoming }) => {
        search = new URL(incoming.url).search;
        return HttpResponse.json(page);
      }),
    );

    await expect(fetchPreWeighings({})).resolves.toEqual(page);
    expect(search).toBe("");
  });

  it("asks for the page after the cursor", async () => {
    let params = new URLSearchParams();
    server.use(
      http.get(apiUrl("/pre-weighings"), ({ request: incoming }) => {
        params = new URL(incoming.url).searchParams;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );

    await fetchPreWeighings({ cursor: "pre-weighing-9" });

    expect(Object.fromEntries(params)).toEqual({ cursor: "pre-weighing-9" });
  });

  it("reads one pre-weighing", async () => {
    server.use(http.get(apiUrl("/pre-weighings/pre-weighing-1"), () => HttpResponse.json(aPreWeighing())));

    await expect(fetchPreWeighing("pre-weighing-1")).resolves.toEqual(aPreWeighing());
  });
});
