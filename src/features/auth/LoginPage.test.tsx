import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LoginPage } from "@/features/auth/LoginPage";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aSessionTokens } from "@/tests/samples";

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Início</p>} />
    </Routes>,
    { route: "/login" },
  );
}

describe("LoginPage", () => {
  it("refuses to call the API with empty fields", async () => {
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe o usuário.")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha.")).toBeInTheDocument();
  });

  it("takes the operator to the application after a successful sign-in", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json(aSessionTokens())),
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())),
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Início")).toBeInTheDocument();
  });

  it("says the credentials are wrong, in Portuguese, without echoing the API", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário ou senha inválidos.");
    expect(screen.queryByText(/Invalid credentials/)).not.toBeInTheDocument();
  });

  it("says to wait a minute after the API rate-limits sign-in attempts", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json({ message: "Too Many Requests" }, { status: 429 })),
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas. Espere um minuto e tente de novo.");
  });

  it("explains an unreachable API differently from a wrong password", async () => {
    server.use(http.post(apiUrl("/sessions/signin"), () => HttpResponse.error()));

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    );
  });
});
