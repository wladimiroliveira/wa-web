import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteRoleDialog } from "@/features/roles/DeleteRoleDialog";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aRole } from "@/tests/samples";

describe("DeleteRoleDialog", () => {
  it("names the role and warns what deleting it costs", () => {
    renderWithProviders(<DeleteRoleDialog role={aRole({ name: "Gerente" })} onOpenChange={() => undefined} />);

    expect(screen.getByText('Excluir o papel "Gerente"?')).toBeInTheDocument();
    expect(
      screen.getByText("Quem tiver esse papel fica sem as permissões que ele dava. Não dá para desfazer."),
    ).toBeInTheDocument();
  });

  it("deletes on confirmation and closes", async () => {
    const onOpenChange = vi.fn();
    let called = false;
    server.use(
      http.delete(apiUrl("/roles/role-1"), () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<DeleteRoleDialog role={aRole({ id: "role-1" })} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(called).toBe(true));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("treats a role someone else already deleted as done, not as a failure", async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.delete(apiUrl("/roles/role-1"), () => HttpResponse.json({ message: "Role not found." }, { status: 404 })),
    );

    renderWithProviders(<DeleteRoleDialog role={aRole({ id: "role-1" })} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the dialog open and explains when the server is at fault", async () => {
    const onOpenChange = vi.fn();
    server.use(http.delete(apiUrl("/roles/role-1"), () => new HttpResponse(null, { status: 502 })));

    renderWithProviders(<DeleteRoleDialog role={aRole({ id: "role-1" })} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir a operação.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
