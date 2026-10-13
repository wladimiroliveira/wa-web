import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createEntry } from "@/features/entries/entries.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { anEntry } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("entries api", () => {
  it("records an entry from the product, the quantity and the unit cost", async () => {
    const body = {
      productSku: "018f0000-0000-7000-8000-000000000020",
      quantity: "10.5",
      unitCost: "4",
      expiresAt: "2099-12-31",
    };
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/entries"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(anEntry(), { status: 201 });
      }),
    );

    await expect(createEntry(body)).resolves.toEqual(anEntry());
    expect(received).toEqual(body);
  });
});
