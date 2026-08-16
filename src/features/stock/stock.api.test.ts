import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createStockEntry, fetchMovements } from "@/features/stock/stock.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const SUPPLY_ID = "33333333-3333-4333-8333-333333333333";

const movement = {
  id: "44444444-4444-4444-8444-444444444444",
  supplyId: SUPPLY_ID,
  type: "ENTRY",
  quantityBase: 5000,
  reason: null,
  note: "Nota 123",
  productionId: null,
  createdAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("stock.api", () => {
  test("fetchMovements returns the page envelope, not a bare array", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () =>
        HttpResponse.json({ data: [movement], nextCursor: null }),
      ),
    );

    await expect(fetchMovements(SUPPLY_ID)).resolves.toEqual({ data: [movement], nextCursor: null });
  });

  test("the first page asks for no cursor", async () => {
    let cursor: string | null = "not-read";
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, ({ request }) => {
        cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await fetchMovements(SUPPLY_ID);

    expect(cursor).toBeNull();
  });

  test("a later page carries the cursor it was given", async () => {
    let cursor: string | null = null;
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, ({ request }) => {
        cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await fetchMovements(SUPPLY_ID, movement.id);

    expect(cursor).toBe(movement.id);
  });

  // The API takes quantity and unit raw and converts with Decimal. Multiplying
  // here would put floating-point noise on a path that is exact today.
  test("createStockEntry sends the quantity and unit raw, without converting to the base", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies/${SUPPLY_ID}/stock-entries`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ movement, currentStock: 17500 }, { status: 201 });
      }),
    );

    const result = await createStockEntry(SUPPLY_ID, { quantity: 5, unit: "KG", note: "Nota 123" });

    expect(body).toEqual({ quantity: 5, unit: "KG", note: "Nota 123" });
    expect(result.currentStock).toBe(17500);
  });
});
