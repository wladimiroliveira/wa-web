import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { UserFormPage } from "@/features/users/UserFormPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

// sonner's <Toaster/> asks next-themes for the OS color scheme on mount, and
// jsdom has no matchMedia. Only this test file mounts a <Toaster/>, so the
// stand-in lives here instead of in the shared test setup.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

const API = "http://localhost:3333";

const roles = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Estoquista",
    permissions: ["STOCK_READ", "STOCK_WRITE"],
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

function renderCreate() {
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
    msw.get(`${API}/roles`, () => HttpResponse.json(roles)),
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
        <Route path="/users/new" element={<UserFormPage />} />
        <Route path="/users" element={<p>users list</p>} />
      </Routes>
    </>,
    { route: "/users/new" },
  );
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText("Nome"), "Maria Souza");
  await userEvent.type(screen.getByLabelText("Usuário"), "Maria");
  await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
}

beforeEach(() => {
  clearSession();
});

describe("UserFormPage — creating", () => {
  test("sends the password and lowercases the username the server would lowercase anyway", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.post(`${API}/users`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "33333333-3333-4333-8333-333333333333" }, { status: 201 });
      }),
    );
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("users list")).toBeInTheDocument();
    expect(received.username).toBe("maria");
    expect(received.password).toBe("segredo123");
  });

  test("a conflict reports both possible fields, because the API does not say which", async () => {
    server.use(
      msw.post(`${API}/users`, () =>
        HttpResponse.json({ message: "Já existe um registro com esse valor único" }, { status: 409 }),
      ),
    );
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/nome de usuário ou e-mail/i);
    expect(screen.queryByText("users list")).not.toBeInTheDocument();
  });

  test("choosing a role checks exactly what that role grants", async () => {
    renderCreate();
    await screen.findByLabelText("Nome");

    await userEvent.selectOptions(screen.getByLabelText("Papel"), "22222222-2222-4222-8222-222222222222");

    expect(screen.getByRole("checkbox", { name: "Estoque — Ler" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Estoque — Escrever" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Insumos — Ler" })).not.toBeChecked();
  });

  test("sends derived exceptions, never the checked set", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.post(`${API}/users`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "33333333-3333-4333-8333-333333333333" }, { status: 201 });
      }),
    );
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "22222222-2222-4222-8222-222222222222");
    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Escrever" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Insumos — Escrever" }));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("users list");
    expect(received.roleId).toBe("22222222-2222-4222-8222-222222222222");
    expect(received.grantedPermissions).toEqual(["SUPPLIES_WRITE"]);
    expect(received.deniedPermissions).toEqual(["STOCK_WRITE"]);
  });

  test("a 500 is not something the form can fix, so it becomes a toast and leaves no in-form alert", async () => {
    server.use(msw.post(`${API}/users`, () => HttpResponse.json({ message: "Erro interno" }, { status: 500 })));
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("Erro interno")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("a network failure is not something the form can fix, so it becomes a toast and leaves no in-form alert", async () => {
    server.use(msw.post(`${API}/users`, () => HttpResponse.error()));
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/não foi possível salvar\. verifique sua conexão\./i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("rejects a username the API would reject, before spending a round trip", async () => {
    renderCreate();
    await screen.findByLabelText("Nome");

    await userEvent.type(screen.getByLabelText("Nome"), "Maria");
    await userEvent.type(screen.getByLabelText("Usuário"), "ma ria!");
    await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/letras, números, ponto, traço e sublinhado/i)).toBeInTheDocument();
  });
});
