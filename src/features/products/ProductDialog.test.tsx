import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductDialog } from "@/features/products/ProductDialog";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aProduct } from "@/tests/samples";

async function fill({ description = "Farinha de trigo", gtin = "" } = {}) {
  await userEvent.type(screen.getByLabelText("Descrição"), description);
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), "Mercadoria");
  await userEvent.selectOptions(screen.getByLabelText("Unidade"), "Quilograma (kg)");
  if (gtin !== "") await userEvent.type(screen.getByLabelText("GTIN (opcional)"), gtin);
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("ProductDialog", () => {
  it("refuses a product with no description, kind or unit", async () => {
    renderWithProviders(<ProductDialog open onOpenChange={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe a descrição do produto.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o tipo.")).toBeInTheDocument();
    expect(screen.getByText("Escolha a unidade.")).toBeInTheDocument();
  });

  it("refuses a GTIN that is not 8 to 14 digits", async () => {
    renderWithProviders(<ProductDialog open onOpenChange={() => undefined} />);

    await fill({ gtin: "789-1000" });

    expect(await screen.findByText("O GTIN tem de 8 a 14 dígitos, só números.")).toBeInTheDocument();
  });

  it("refuses a GTIN whose check digit does not match", async () => {
    renderWithProviders(<ProductDialog open onOpenChange={() => undefined} />);

    await fill({ gtin: "7891000100104" });

    expect(await screen.findByText("O dígito verificador do GTIN não confere. Revise o código.")).toBeInTheDocument();
  });

  it("hands over the product it registered", async () => {
    const onCreated = vi.fn();
    const bread = aProduct({ description: "Pão francês", kind: "MANUFACTURED" });
    server.use(http.post(apiUrl("/products"), () => HttpResponse.json(bread, { status: 201 })));

    renderWithProviders(<ProductDialog open onOpenChange={() => undefined} onCreated={onCreated} />);
    await fill();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(bread));
  });

  it("registers the product and closes", async () => {
    const onOpenChange = vi.fn();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/products"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aProduct(), { status: 201 });
      }),
    );

    renderWithProviders(<ProductDialog open onOpenChange={onOpenChange} />);
    await fill({ gtin: "7891000100103" });

    await waitFor(() =>
      expect(received).toEqual({
        description: "Farinha de trigo",
        kind: "GOODS",
        unit: "KILOGRAM",
        gtin: "7891000100103",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves the GTIN out of the request when it was not typed", async () => {
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/products"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aProduct(), { status: 201 });
      }),
    );

    renderWithProviders(<ProductDialog open onOpenChange={() => undefined} />);
    await fill();

    await waitFor(() => expect(received).toEqual({ description: "Farinha de trigo", kind: "GOODS", unit: "KILOGRAM" }));
  });

  it("says the product is already in the catalog, in Portuguese, and keeps the dialog open", async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.post(apiUrl("/products"), () =>
        HttpResponse.json({ message: "A product with this description already exists." }, { status: 409 }),
      ),
    );

    renderWithProviders(<ProductDialog open onOpenChange={onOpenChange} />);
    await fill();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um produto com essa descrição ou com esse GTIN.",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("opens empty again after a product was typed and the dialog closed", async () => {
    const { rerender } = renderWithProviders(<ProductDialog open onOpenChange={() => undefined} />);

    await userEvent.type(screen.getByLabelText("Descrição"), "Farinha");

    rerender(<ProductDialog open={false} onOpenChange={() => undefined} />);
    rerender(<ProductDialog open onOpenChange={() => undefined} />);

    expect(await screen.findByLabelText("Descrição")).toHaveValue("");
  });
});
