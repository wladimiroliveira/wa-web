import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createSupplier, fetchSuppliers, suppliersKeys } from "@/features/suppliers/suppliers.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aSupplier } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("suppliers api", () => {
  it("names the cache entry every screen that picks a supplier shares", () => {
    expect(suppliersKeys.all).toEqual(["suppliers"]);
  });

  it("lists the suppliers", async () => {
    const supplier = aSupplier();
    server.use(http.get(apiUrl("/suppliers"), () => HttpResponse.json([supplier])));

    await expect(fetchSuppliers()).resolves.toEqual([supplier]);
  });

  it("registers a supplier from its name", async () => {
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/suppliers"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aSupplier(), { status: 201 });
      }),
    );

    await expect(createSupplier({ name: "Moinho Santa Clara" })).resolves.toEqual(aSupplier());
    expect(received).toEqual({ name: "Moinho Santa Clara" });
  });
});
