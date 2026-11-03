import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { getRefreshToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aSessionTokens } from "@/tests/samples";

function renderPage() {
  setRefreshToken("refresh-one");
  server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())));

  return renderWithProviders(
    <Routes>
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/login" element={<p>Entrar</p>} />
    </Routes>,
    { route: "/change-password" },
  );
}

async function fill(current: string, next: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText("Senha atual"), current);
  await userEvent.type(screen.getByLabelText("Nova senha"), next);
  await userEvent.type(screen.getByLabelText("Repita a nova senha"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
}

describe("ChangePasswordPage", () => {
  it("refuses a new password shorter than the API accepts, without asking the API", async () => {
    renderPage();

    await fill("old-secret", "short", "short");

    expect(await screen.findByText("A nova senha precisa de pelo menos 8 caracteres.")).toBeInTheDocument();
  });

  it("refuses a confirmation that does not match", async () => {
    renderPage();

    await fill("old-secret", "new-secret-1", "new-secret-2");

    expect(await screen.findByText("As senhas não conferem.")).toBeInTheDocument();
  });

  it("says the current password is wrong, in Portuguese, and keeps the session", async () => {
    renderPage();
    server.use(
      // The refresh has to be mocked here, and its presence is the point. The HTTP
      // client renews on ANY interceptable 401 before treating it as the endpoint's
      // own answer — so a mistyped current password costs one token rotation. That is
      // the correct trade: excluding this route from interception would break the case
      // where the access token had genuinely expired.
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-two" })),
      ),
      http.patch(apiUrl("/sessions/me/password"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    await fill("wrong-secret", "new-secret-1", "new-secret-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual não confere.");
    // A typo is not an expired session. This pins the fix made in Task 5 from the
    // screen's side: the operator stays signed in and reads the real reason.
    expect(getRefreshToken()).toBe("refresh-two");
  });

  it("ends the session after the change, because the API revoked every token", async () => {
    renderPage();
    server.use(
      http.patch(apiUrl("/sessions/me/password"), () => new HttpResponse(null, { status: 204 })),
      // The success path calls signOut(), which POSTs here with the refresh token
      // the API just revoked. Matches the mock every other signOut()-exercising
      // test in this codebase uses (e.g. AppShell.test.tsx) to keep stderr clean.
      http.post(apiUrl("/sessions/signout"), () => new HttpResponse(null, { status: 204 })),
    );

    await fill("old-secret", "new-secret-1", "new-secret-1");

    expect(await screen.findByText("Entrar")).toBeInTheDocument();
    expect(getRefreshToken()).toBeNull();
  });
});
