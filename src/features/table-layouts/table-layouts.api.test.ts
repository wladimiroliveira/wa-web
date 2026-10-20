import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import {
  fetchTableLayouts,
  resetTableLayout,
  saveTableLayout,
  tableLayoutsKeys,
} from "@/features/table-layouts/table-layouts.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";

beforeEach(() => {
  setAccessToken("access-token");
});

const LAYOUT = { tableKey: "products", order: ["kind", "description"], widths: { description: 320 } };

describe("table layouts api", () => {
  it("names the one cache entry every table reads its layout from", () => {
    expect(tableLayoutsKeys.all).toEqual(["table-layouts"]);
  });

  it("lists the layouts the user gave their tables", async () => {
    server.use(http.get(apiUrl("/sessions/me/table-layouts"), () => HttpResponse.json([LAYOUT])));

    await expect(fetchTableLayouts()).resolves.toEqual([LAYOUT]);
  });

  it("records the order and the widths of one table", async () => {
    let received: unknown = null;
    server.use(
      http.put(apiUrl("/sessions/me/table-layouts/products"), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(LAYOUT);
      }),
    );

    await expect(saveTableLayout("products", { order: LAYOUT.order, widths: LAYOUT.widths })).resolves.toEqual(LAYOUT);
    expect(received).toEqual({ order: ["kind", "description"], widths: { description: 320 } });
  });

  it("forgets the layout of one table", async () => {
    let deleted = false;
    server.use(
      http.delete(apiUrl("/sessions/me/table-layouts/products"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await resetTableLayout("products");

    expect(deleted).toBe(true);
  });
});
