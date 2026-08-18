import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createSupply, deleteSupply, fetchSupplies, fetchSupply, updateSupply } from "@/features/supplies/supplies.api";
import { ApiError } from "@/lib/http";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const supply = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("supplies.api", () => {
  test("fetchSupplies returns the list", async () => {
    server.use(msw.get(`${API}/supplies`, () => HttpResponse.json([supply])));

    await expect(fetchSupplies()).resolves.toEqual([supply]);
  });

  test("fetchSupply asks for one by id", async () => {
    server.use(msw.get(`${API}/supplies/${supply.id}`, () => HttpResponse.json(supply)));

    await expect(fetchSupply(supply.id)).resolves.toEqual(supply);
  });

  test("createSupply posts the five fields", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(supply, { status: 201 });
      }),
    );

    await createSupply({
      name: "Farinha de trigo",
      type: "INGREDIENT",
      purchaseUnit: "KG",
      purchaseQty: 5,
      purchasePrice: 24,
    });

    expect(body).toEqual({
      name: "Farinha de trigo",
      type: "INGREDIENT",
      purchaseUnit: "KG",
      purchaseQty: 5,
      purchasePrice: 24,
    });
  });

  test("updateSupply patches", async () => {
    let method: string | undefined;
    server.use(
      msw.patch(`${API}/supplies/${supply.id}`, ({ request }) => {
        method = request.method;
        return HttpResponse.json(supply);
      }),
    );

    await updateSupply(supply.id, { purchasePrice: 26 });

    expect(method).toBe("PATCH");
  });

  test("deleteSupply resolves on the 204", async () => {
    server.use(msw.delete(`${API}/supplies/${supply.id}`, () => new HttpResponse(null, { status: 204 })));

    await expect(deleteSupply(supply.id)).resolves.toBeUndefined();
  });

  // Both `RecipeItem.supplyId` and `StockMovement.supplyId` are `onDelete:
  // Restrict` in the API's schema, so a supply that ever moved can never be
  // deleted. The status has to reach the caller for the screen to say why.
  test("deleteSupply rejects with the 409 status when the supply is referenced", async () => {
    server.use(
      msw.delete(`${API}/supplies/${supply.id}`, () =>
        HttpResponse.json({ message: "Operação viola uma referência existente" }, { status: 409 }),
      ),
    );

    await expect(deleteSupply(supply.id)).rejects.toMatchObject({ status: 409 });
    await expect(deleteSupply(supply.id)).rejects.toBeInstanceOf(ApiError);
  });
});
