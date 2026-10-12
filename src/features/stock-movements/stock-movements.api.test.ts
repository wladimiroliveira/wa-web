import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { fetchStockMovements, stockMovementsKeys } from "@/features/stock-movements/stock-movements.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aStockMovement } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("stock movements api", () => {
  it("names one cache entry per product filter, all under the feature's own", () => {
    expect(stockMovementsKeys.all).toEqual(["stock-movements"]);
    expect(stockMovementsKeys.list("sku-1")).toEqual(["stock-movements", { productSku: "sku-1" }]);
  });

  it("lists the first page of every movement when nothing is asked", async () => {
    const page = { items: [aStockMovement()], nextCursor: null };
    let search = "?";
    server.use(
      http.get(apiUrl("/stock-movements"), ({ request: incoming }) => {
        search = new URL(incoming.url).search;
        return HttpResponse.json(page);
      }),
    );

    await expect(fetchStockMovements({})).resolves.toEqual(page);
    expect(search).toBe("");
  });

  it("asks for the page after the cursor, of the chosen product", async () => {
    let params = new URLSearchParams();
    server.use(
      http.get(apiUrl("/stock-movements"), ({ request: incoming }) => {
        params = new URL(incoming.url).searchParams;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );

    await fetchStockMovements({ productSku: "sku-1", cursor: "movement-9" });

    expect(Object.fromEntries(params)).toEqual({ productSku: "sku-1", cursor: "movement-9" });
  });
});
