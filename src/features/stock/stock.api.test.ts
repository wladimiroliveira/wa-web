import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { fetchProductStock, fetchStockPosition, stockKeys } from "@/features/stock/stock.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aProductStock, aStockPosition } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("stock api", () => {
  it("names the cache entry whatever moves the stock invalidates", () => {
    expect(stockKeys.all).toEqual(["stock"]);
  });

  it("reads the position of the stock", async () => {
    const position = aStockPosition();
    server.use(http.get(apiUrl("/stock"), () => HttpResponse.json(position)));

    await expect(fetchStockPosition()).resolves.toEqual(position);
  });

  it("names the lots of a product under the same entry, so one invalidation reaches them", () => {
    expect(stockKeys.product("sku-1", false)).toEqual(["stock", "sku-1", { depleted: false }]);
  });

  it("reads the lots a product still holds", async () => {
    let search = "?";
    server.use(
      http.get(apiUrl("/stock/sku-1"), ({ request: incoming }) => {
        search = new URL(incoming.url).search;
        return HttpResponse.json(aProductStock());
      }),
    );

    await expect(fetchProductStock("sku-1", false)).resolves.toEqual(aProductStock());
    expect(search).toBe("");
  });

  it("asks for the depleted lots too when they are wanted", async () => {
    let search = "";
    server.use(
      http.get(apiUrl("/stock/sku-1"), ({ request: incoming }) => {
        search = new URL(incoming.url).search;
        return HttpResponse.json(aProductStock());
      }),
    );

    await fetchProductStock("sku-1", true);

    expect(search).toBe("?depleted=true");
  });
});
