import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleDialog } from "@/features/roles/RoleDialog";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aRole } from "@/tests/samples";

describe("RoleDialog", () => {
  it("refuses to submit a role with no name and no permission", async () => {
    renderWithProviders(<RoleDialog role={null} open onOpenChange={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome do papel.")).toBeInTheDocument();
    expect(screen.getByText("Escolha ao menos uma permissão.")).toBeInTheDocument();
  });

  it("creates a role with the chosen permissions and closes", async () => {
    const onOpenChange = vi.fn();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/roles"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole(), { status: 201 });
      }),
    );

    renderWithProviders(<RoleDialog role={null} open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Produção");
    await userEvent.click(screen.getByRole("checkbox", { name: "Registrar produção" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(received).toEqual({ name: "Produção", permissions: ["PRODUCTION_CREATE"] }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens already filled when editing, and sends the change", async () => {
    let received: unknown = null;
    server.use(
      http.patch(apiUrl("/roles/role-1"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole({ id: "role-1", name: "Gerência" }));
      }),
    );

    renderWithProviders(
      <RoleDialog
        role={aRole({ id: "role-1", name: "Gerente", permissions: ["ACCESS_READ"] })}
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Gerente");
    expect(screen.getByRole("checkbox", { name: "Ver usuários e papéis" })).toBeChecked();

    await userEvent.clear(screen.getByLabelText("Nome"));
    await userEvent.type(screen.getByLabelText("Nome"), "Gerência");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(received).toEqual({ name: "Gerência", permissions: ["ACCESS_READ"] }));
  });

  it("says the name is taken, in Portuguese, and keeps the dialog open", async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.post(apiUrl("/roles"), () =>
        HttpResponse.json({ message: "A role with this name already exists." }, { status: 409 }),
      ),
    );

    renderWithProviders(<RoleDialog role={null} open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Gerente");
    await userEvent.click(screen.getByRole("checkbox", { name: "Ver usuários e papéis" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um papel com esse nome.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows the reopened role's values, never the previous one's", async () => {
    const { rerender } = renderWithProviders(
      <RoleDialog role={aRole({ id: "role-1", name: "Gerente" })} open onOpenChange={() => undefined} />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Gerente");

    // Closing and reopening for a different role is the sequence that breaks a form
    // built once and never reset — the values would still be the first role's.
    rerender(<RoleDialog role={null} open={false} onOpenChange={() => undefined} />);
    rerender(<RoleDialog role={aRole({ id: "role-2", name: "Produção" })} open onOpenChange={() => undefined} />);

    expect(await screen.findByLabelText("Nome")).toHaveValue("Produção");
  });
});
