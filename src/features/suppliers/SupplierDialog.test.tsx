import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SupplierDialog } from "@/features/suppliers/SupplierDialog";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aSupplier } from "@/tests/samples";

describe("SupplierDialog", () => {
  it("refuses a supplier with no name", async () => {
    renderWithProviders(<SupplierDialog open onOpenChange={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome do fornecedor.")).toBeInTheDocument();
  });

  it("registers the supplier and closes", async () => {
    const onOpenChange = vi.fn();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/suppliers"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aSupplier(), { status: 201 });
      }),
    );

    renderWithProviders(<SupplierDialog open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Moinho Santa Clara");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(received).toEqual({ name: "Moinho Santa Clara" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says the name is taken, in Portuguese, and keeps the dialog open", async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.post(apiUrl("/suppliers"), () =>
        HttpResponse.json({ message: "A supplier with this name already exists." }, { status: 409 }),
      ),
    );

    renderWithProviders(<SupplierDialog open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Moinho Santa Clara");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um fornecedor com esse nome.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("opens empty again after a name was typed and the dialog closed", async () => {
    const { rerender } = renderWithProviders(<SupplierDialog open onOpenChange={() => undefined} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Moinho");

    rerender(<SupplierDialog open={false} onOpenChange={() => undefined} />);
    rerender(<SupplierDialog open onOpenChange={() => undefined} />);

    expect(await screen.findByLabelText("Nome")).toHaveValue("");
  });
});
