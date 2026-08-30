import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequireSession } from "@/features/auth/RequireSession";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

function renderGuarded(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>Entrar</p>} />
      <Route element={<RequireSession />}>
        <Route path="/roles" element={<p>Papéis</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe("RequireSession", () => {
  it("sends an anonymous visitor to the sign-in screen", async () => {
    renderGuarded("/roles");

    expect(await screen.findByText("Entrar")).toBeInTheDocument();
    expect(screen.queryByText("Papéis")).not.toBeInTheDocument();
  });

  it("lets a signed-in operator through", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())));

    renderGuarded("/roles");

    expect(await screen.findByText("Papéis")).toBeInTheDocument();
  });
});
