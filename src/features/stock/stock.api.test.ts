import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { fetchStockPosition, stockKeys } from "@/features/stock/stock.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aStockPosition } from "@/tests/samples";

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
});
