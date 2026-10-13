import { HttpResponse, http } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PreWeighingDetailPage } from "@/features/pre-weighings/PreWeighingDetailPage";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aPreWeighing } from "@/tests/samples";

const open = () =>
  renderWithProviders(
    <Routes>
      <Route path="/pre-weighings/:id" element={<PreWeighingDetailPage />} />
    </Routes>,
    { route: "/pre-weighings/pre-weighing-1" },
  );

describe("PreWeighingDetailPage", () => {
  it("shows what was to be produced, when it was weighed and each ingredient planned against weighed", async () => {
    server.use(
      http.get(apiUrl("/pre-weighings/pre-weighing-1"), () =>
        HttpResponse.json(
          aPreWeighing({
            quantity: "10.5",
            createdAt: "2026-10-02T12:00:00.000Z",
            items: [
              {
                product: { sku: "sku-1", description: "Farinha de trigo", unit: "KILOGRAM" },
                plannedQuantity: "6",
                weighedQuantity: "6.05",
              },
              {
                product: { sku: "sku-2", description: "Sal", unit: "GRAM" },
                plannedQuantity: "120",
                weighedQuantity: "118.5",
              },
            ],
          }),
        ),
      ),
    );

    open();

    expect(await screen.findByRole("heading", { name: "Pré-pesagem de Pão francês" })).toBeInTheDocument();

    const summary = within(screen.getByRole("group", { name: "Resumo da pré-pesagem" }));
    expect(summary.getByText("10,5 kg")).toBeInTheDocument();
    expect(summary.getByText(/^02\/10\/2026/)).toBeInTheDocument();

    const [, flour, salt] = screen.getAllByRole("row");
    expect(within(flour!).getByText("Farinha de trigo")).toBeInTheDocument();
    expect(within(flour!).getByText("6 kg")).toBeInTheDocument();
    expect(within(flour!).getByText("6,05 kg")).toBeInTheDocument();
    expect(within(salt!).getByText("120 g")).toBeInTheDocument();
    expect(within(salt!).getByText("118,5 g")).toBeInTheDocument();
  });

  it("leads back to the list", async () => {
    server.use(http.get(apiUrl("/pre-weighings/pre-weighing-1"), () => HttpResponse.json(aPreWeighing())));

    open();

    expect(await screen.findByRole("link", { name: "Voltar para as pré-pesagens" })).toHaveAttribute(
      "href",
      "/pre-weighings",
    );
  });

  it("says the pre-weighing does not exist instead of offering to try again", async () => {
    server.use(
      http.get(apiUrl("/pre-weighings/pre-weighing-1"), () =>
        HttpResponse.json({ message: "Pre-weighing not found." }, { status: 404 }),
      ),
    );

    open();

    expect(await screen.findByRole("alert")).toHaveTextContent("Essa pré-pesagem não existe.");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("offers a way out when it fails to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/pre-weighings/pre-weighing-1"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json(aPreWeighing());
      }),
    );

    open();

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("heading", { name: "Pré-pesagem de Pão francês" })).toBeInTheDocument();
  });
});
