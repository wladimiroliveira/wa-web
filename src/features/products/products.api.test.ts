import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createProduct, fetchProducts, productsKeys } from "@/features/products/products.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aProduct } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("products api", () => {
  it("names the cache entry every screen that picks a product shares", () => {
    expect(productsKeys.all).toEqual(["products"]);
  });

  it("lists the products", async () => {
    const product = aProduct();
    server.use(http.get(apiUrl("/products"), () => HttpResponse.json([product])));

    await expect(fetchProducts()).resolves.toEqual([product]);
  });

  it("registers a product from its description, kind and unit", async () => {
    const body = { description: "Farinha de trigo", kind: "GOODS", unit: "KILOGRAM" } as const;
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/products"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aProduct(), { status: 201 });
      }),
    );

    await expect(createProduct(body)).resolves.toEqual(aProduct());
    expect(received).toEqual(body);
  });
});
