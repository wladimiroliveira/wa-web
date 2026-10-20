import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PreWeighingsListPage } from "@/features/pre-weighings/PreWeighingsListPage";
import type { Permission } from "@/lib/api";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { arrangedTable, columnHeaders } from "@/tests/table-layouts";
import { aCurrentUser, aPreWeighing } from "@/tests/samples";

function signedIn(permissions: Permission[] = ["PRODUCTION_READ"]) {
  setRefreshToken("refresh-one");
  server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions }))));
}

const listing = (items = [aPreWeighing()]) =>
  server.use(http.get(apiUrl("/pre-weighings"), () => HttpResponse.json({ items, nextCursor: null })));

describe("PreWeighingsListPage", () => {
  it("lists each pre-weighing with its date, product, quantity and how many ingredients it took", async () => {
    signedIn();
    listing([
      aPreWeighing({
        id: "pre-weighing-1",
        quantity: "10.5",
        createdAt: "2026-10-02T12:00:00.000Z",
        items: [
          aPreWeighing().items[0]!,
          { ...aPreWeighing().items[0]!, product: { sku: "sku-2", description: "Sal", unit: "GRAM" } },
        ],
      }),
    ]);

    renderWithProviders(<PreWeighingsListPage />);

    const [, row] = await screen.findAllByRole("row");

    expect(within(row!).getByText(/^02\/10\/2026/)).toBeInTheDocument();
    expect(within(row!).getByRole("link", { name: "Pão francês" })).toHaveAttribute(
      "href",
      "/pre-weighings/pre-weighing-1",
    );
    expect(within(row!).getByText("10,5 kg")).toBeInTheDocument();
    expect(within(row!).getByText("2")).toBeInTheDocument();
  });

  it("says nothing was weighed yet instead of showing a bare table", async () => {
    signedIn();
    listing([]);

    renderWithProviders(<PreWeighingsListPage />);

    expect(await screen.findByText("Nenhuma pré-pesagem registrada.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    signedIn();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/pre-weighings"), () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 502 })
          : HttpResponse.json({ items: [aPreWeighing()], nextCursor: null });
      }),
    );

    renderWithProviders(<PreWeighingsListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("link", { name: "Pão francês" })).toBeInTheDocument();
  });

  it("loads the older pre-weighings on request, until there are no more", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/pre-weighings"), ({ request: incoming }) =>
        new URL(incoming.url).searchParams.get("cursor") === "pre-weighing-2"
          ? HttpResponse.json({
              items: [
                aPreWeighing({
                  id: "pre-weighing-1",
                  product: { sku: "sku-9", description: "Pão de queijo", unit: "KILOGRAM" },
                }),
              ],
              nextCursor: null,
            })
          : HttpResponse.json({ items: [aPreWeighing({ id: "pre-weighing-2" })], nextCursor: "pre-weighing-2" }),
      ),
    );

    renderWithProviders(<PreWeighingsListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByRole("link", { name: "Pão de queijo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pão francês" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("offers a new pre-weighing to whoever may record one and read the catalog", async () => {
    signedIn(["PRODUCTION_READ", "PRODUCTION_CREATE", "CATALOG_READ"]);
    listing();

    renderWithProviders(<PreWeighingsListPage />);

    expect(await screen.findByRole("link", { name: "Nova pré-pesagem" })).toHaveAttribute("href", "/pre-weighings/new");
  });

  it("offers the registration as an icon link in the row of the count", async () => {
    signedIn(["PRODUCTION_READ", "PRODUCTION_CREATE", "CATALOG_READ"]);
    listing();

    renderWithProviders(<PreWeighingsListPage />);

    const create = await screen.findByRole("link", { name: "Nova pré-pesagem" });
    expect(create).toHaveTextContent("");
    expect(create.closest("div")).toContainElement(screen.getByText("1 pré-pesagem"));
  });

  it("still offers the registration when the list is empty", async () => {
    signedIn(["PRODUCTION_READ", "PRODUCTION_CREATE", "CATALOG_READ"]);
    listing([]);

    renderWithProviders(<PreWeighingsListPage />);

    await screen.findByText("Nenhuma pré-pesagem registrada.");
    expect(screen.getByRole("link", { name: "Nova pré-pesagem" })).toBeInTheDocument();
  });

  it("leaves the new pre-weighing out for whoever may only read", async () => {
    signedIn(["PRODUCTION_READ", "CATALOG_READ"]);
    listing();

    renderWithProviders(<PreWeighingsListPage />);

    await screen.findByRole("link", { name: "Pão francês" });
    expect(screen.queryByRole("link", { name: "Nova pré-pesagem" })).not.toBeInTheDocument();
  });
});

describe("PreWeighingsListPage layout", () => {
  it("gives the table the height left on the screen", async () => {
    signedIn();
    listing();

    renderWithProviders(<PreWeighingsListPage />);

    await screen.findByRole("table");
    expect(screen.getByRole("table").parentElement).toHaveAttribute("data-fill", "true");
  });
});

describe("PreWeighingsListPage columns", () => {
  it("shows the columns in the order the user arranged them", async () => {
    arrangedTable("pre-weighings", { order: ["product", "date"] });
    signedIn();
    listing();

    renderWithProviders(<PreWeighingsListPage />);

    await waitFor(() => expect(columnHeaders()[0]).toBe("Produto"));
  });
});

describe("PreWeighingsListPage sizing", () => {
  it("keeps the link to each pre-weighing as tall as a control", async () => {
    signedIn();
    listing();

    renderWithProviders(<PreWeighingsListPage />);

    expect(await screen.findByRole("link", { name: "Pão francês" })).toHaveClass("min-h-8");
  });
});
