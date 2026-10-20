import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { arrangedTable, columnHeaders } from "@/tests/table-layouts";
import { chooseRowAction } from "@/tests/row-actions";
import { aCurrentUser, aRole } from "@/tests/samples";

function signedIn() {
  setRefreshToken("refresh-one");
  server.use(
    http.get(apiUrl("/sessions/me"), () =>
      HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ", "ACCESS_CREATE", "ACCESS_UPDATE"] })),
    ),
  );
}

describe("RolesListPage", () => {
  it("lists each role with its permissions named in Portuguese", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/roles"), () =>
        HttpResponse.json([aRole({ id: "role-1", name: "Gerente", permissions: ["ACCESS_READ"] })]),
      ),
    );

    renderWithProviders(<RolesListPage />);

    expect(await screen.findByText("Gerente")).toBeInTheDocument();
    expect(screen.getByText("Ver usuários e papéis")).toBeInTheDocument();
  });

  it("offers the registration as an icon button in the row of the count", async () => {
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([aRole({ name: "Gerente" })])));

    renderWithProviders(<RolesListPage />);

    const create = await screen.findByRole("button", { name: "Novo papel" });
    expect(create).toHaveTextContent("");
    expect(create.closest("div")).toContainElement(screen.getByText("1 papel"));
  });

  it("still offers the registration when the list is empty", async () => {
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([])));

    renderWithProviders(<RolesListPage />);

    await screen.findByText("Nenhum papel cadastrado ainda.");
    expect(screen.getByRole("button", { name: "Novo papel" })).toBeInTheDocument();
  });

  it("says the list is empty instead of showing a bare table", async () => {
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([])));

    renderWithProviders(<RolesListPage />);

    expect(await screen.findByText("Nenhum papel cadastrado ainda.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    signedIn();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/roles"), () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 502 })
          : HttpResponse.json([aRole({ name: "Gerente" })]);
      }),
    );

    renderWithProviders(<RolesListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Gerente")).toBeInTheDocument();
  });

  it("opens the dialog filled with the role whose row was clicked", async () => {
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([aRole({ id: "role-1", name: "Gerente" })])));

    renderWithProviders(<RolesListPage />);

    await chooseRowAction("Ações de Gerente", "Editar");

    expect(await screen.findByLabelText("Nome", { selector: "input" })).toHaveValue("Gerente");
  });

  it("drops the deleted role from the list without a manual reload", async () => {
    signedIn();
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/roles"), () => {
        listCalls += 1;
        return HttpResponse.json(listCalls === 1 ? [aRole({ id: "role-1", name: "Gerente" })] : []);
      }),
      http.delete(apiUrl("/roles/role-1"), () => new HttpResponse(null, { status: 204 })),
    );

    renderWithProviders(<RolesListPage />);

    await chooseRowAction("Ações de Gerente", "Excluir");
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    // The row is gone because the cache was invalidated and refetched — not because
    // anything reloaded the page.
    expect(await screen.findByText("Nenhum papel cadastrado ainda.")).toBeInTheDocument();
    expect(listCalls).toBe(2);
  });
});

describe("RolesListPage layout", () => {
  it("gives the table the height left on the screen", async () => {
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([aRole({ name: "Gerente" })])));

    renderWithProviders(<RolesListPage />);

    await screen.findByText("Gerente");
    expect(screen.getByRole("table").parentElement).toHaveAttribute("data-fill", "true");
  });
});

describe("RolesListPage columns", () => {
  it("shows the columns in the order the user arranged them", async () => {
    arrangedTable("roles", { order: ["permissions", "name"] });
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([aRole()])));

    renderWithProviders(<RolesListPage />);

    await waitFor(() => expect(columnHeaders()[0]).toBe("Permissões"));
  });
});
