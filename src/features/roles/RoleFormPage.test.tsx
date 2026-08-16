import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { RoleFormPage } from "@/features/roles/RoleFormPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const role = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Estoquista",
  permissions: ["STOCK_READ", "STOCK_WRITE"],
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

function renderForm(route: string) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["USERS_READ", "USERS_WRITE"],
      }),
    ),
    msw.get(`${API}/roles`, () => HttpResponse.json([role])),
    msw.get(`${API}/users`, () => HttpResponse.json([])),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      {/* Mounted here, not via renderWithProviders: in the app it lives once in
          src/app/providers.tsx, outside the router. Tests that need to observe
          a toast render it locally instead of changing shared test setup. */}
      <Toaster />
      <Routes>
        <Route path="/roles/new" element={<RoleFormPage />} />
        <Route path="/roles/:id" element={<RoleFormPage />} />
        <Route path="/roles" element={<p>roles list</p>} />
      </Routes>
    </>,
    { route },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RoleFormPage", () => {
  test("creates a role with the checked permissions", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.post(`${API}/roles`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(role, { status: 201 });
      }),
    );
    renderForm("/roles/new");

    await userEvent.type(await screen.findByLabelText("Nome"), "Confeiteiro");
    await userEvent.click(screen.getByRole("checkbox", { name: "Receitas — Ler" }));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("roles list");
    expect(received).toEqual({ name: "Confeiteiro", permissions: ["RECIPES_READ"] });
  });

  test("a duplicate name is an inline error, because name is the only unique field", async () => {
    server.use(
      msw.post(`${API}/roles`, () =>
        HttpResponse.json({ message: "Já existe um registro com esse valor único" }, { status: 409 }),
      ),
    );
    renderForm("/roles/new");

    await userEvent.type(await screen.findByLabelText("Nome"), "Estoquista");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/já existe um papel com esse nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveAttribute("aria-invalid", "true");
  });

  test("a 500 is not something the form can fix, so it becomes a toast and leaves no inline field error", async () => {
    server.use(msw.post(`${API}/roles`, () => HttpResponse.json({ message: "Erro interno" }, { status: 500 })));
    renderForm("/roles/new");

    await userEvent.type(await screen.findByLabelText("Nome"), "Confeiteiro");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("Erro interno")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("a network failure is not something the form can fix, so it becomes a toast and leaves no inline field error", async () => {
    server.use(msw.post(`${API}/roles`, () => HttpResponse.error()));
    renderForm("/roles/new");

    await userEvent.type(await screen.findByLabelText("Nome"), "Confeiteiro");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/não foi possível salvar\. verifique sua conexão\./i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).not.toHaveAttribute("aria-invalid", "true");
  });

  // A 401 from the mutation means `request` already cleared the session (see
  // SessionExpiredError in src/lib/http.ts) — there is nothing left to fix by
  // editing Nome, so this must not repeat the 409 case above and land as an
  // inline error on the only field the form has.
  test("a session that expired mid-save is a toast, not an inline error on Nome", async () => {
    server.use(
      msw.patch(`${API}/roles/${role.id}`, () =>
        HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 }),
      ),
      msw.post(`${API}/sessions/refresh`, () => HttpResponse.json({ message: "Token inválido" }, { status: 401 })),
    );
    renderForm(`/roles/${role.id}`);

    await screen.findByLabelText("Nome");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/sua sessão expirou\. entre novamente\./i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("editing opens with the role's own permissions checked", async () => {
    renderForm(`/roles/${role.id}`);

    expect(await screen.findByLabelText("Nome")).toHaveValue("Estoquista");
    expect(screen.getByRole("checkbox", { name: "Estoque — Escrever" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Insumos — Ler" })).not.toBeChecked();
  });

  test("editing sends a PATCH to the role's own id with the edited name and permissions", async () => {
    let receivedMethod = "";
    let receivedUrl = "";
    let received: Record<string, unknown> = {};
    server.use(
      msw.patch(`${API}/roles/${role.id}`, async ({ request }) => {
        receivedMethod = request.method;
        receivedUrl = request.url;
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(role);
      }),
    );
    renderForm(`/roles/${role.id}`);

    const nameInput = await screen.findByLabelText("Nome");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Estoquista Sênior");
    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Ler" })); // uncheck STOCK_READ
    await userEvent.click(screen.getByRole("checkbox", { name: "Receitas — Ler" })); // check RECIPES_READ
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("roles list");
    expect(receivedMethod).toBe("PATCH");
    expect(receivedUrl).toBe(`${API}/roles/${role.id}`);
    expect(received).toEqual({ name: "Estoquista Sênior", permissions: ["STOCK_WRITE", "RECIPES_READ"] });
  });

  test("editing shows no origin annotations — a role has no exceptions", async () => {
    renderForm(`/roles/${role.id}`);

    await screen.findByLabelText("Nome");
    expect(screen.queryByTestId("origin-STOCK_READ")).not.toBeInTheDocument();
  });
});
