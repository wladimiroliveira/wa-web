import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { clearSession } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const ME = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Owner",
  username: "owner",
  email: "owner@example.com",
  permissions: ["SUPPLIES_READ"],
};

function renderLogin(route = "/login") {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>home</p>} />
      <Route path="/supplies" element={<p>supplies screen</p>} />
    </Routes>,
    { route },
  );
}

async function submitCredentials(password = "secret123") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Usuário"), "owner");
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  clearSession();
});

describe("LoginPage", () => {
  test("lands on the home page after a successful login", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ accessToken: "access-1", refreshToken: "refresh-1" })),
      msw.get(`${API}/me`, () => HttpResponse.json(ME)),
    );

    renderLogin();
    await submitCredentials();

    expect(await screen.findByText("home")).toBeInTheDocument();
  });

  test("returns to the route the user originally asked for", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ accessToken: "access-1", refreshToken: "refresh-1" })),
      msw.get(`${API}/me`, () => HttpResponse.json(ME)),
    );

    // This is exactly what RequireSession hands over when it bounces someone
    // to the login screen: the route they were originally headed for.
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/supplies" element={<p>supplies screen</p>} />
      </Routes>,
      { route: "/login", state: { from: { pathname: "/supplies" } } },
    );

    await submitCredentials();

    expect(await screen.findByText("supplies screen")).toBeInTheDocument();
  });

  test("shows the API's own message when the credentials are wrong", async () => {
    server.use(
      msw.post(`${API}/sessions`, () => HttpResponse.json({ message: "Credenciais inválidas" }, { status: 401 })),
    );

    renderLogin();
    await submitCredentials("wrong");

    expect(await screen.findByText("Credenciais inválidas")).toBeInTheDocument();
  });

  test("tells the user to wait on 429 instead of repeating the credential error", async () => {
    server.use(msw.post(`${API}/sessions`, () => HttpResponse.json({ message: "Too many requests" }, { status: 429 })));

    renderLogin();
    await submitCredentials();

    expect(await screen.findByText(/muitas tentativas/i)).toBeInTheDocument();
    expect(screen.queryByText("Credenciais inválidas")).not.toBeInTheDocument();
  });

  test("refuses to submit a username shorter than the API accepts", async () => {
    let called = false;
    server.use(
      msw.post(`${API}/sessions`, () => {
        called = true;
        return HttpResponse.json({ accessToken: "a", refreshToken: "b" });
      }),
    );

    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Usuário"), "ab");
    await user.type(screen.getByLabelText("Senha"), "secret123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText(/pelo menos 3 caracteres/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
