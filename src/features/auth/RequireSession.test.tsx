import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { RequireSession } from "@/features/auth/RequireSession";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
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

function renderGuardedTree(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login screen</p>} />
      <Route element={<RequireSession />}>
        <Route path="/" element={<p>protected content</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RequireSession", () => {
  test("goes straight to login without calling /me when no refresh token is stored", async () => {
    let meCalls = 0;
    server.use(
      msw.get(`${API}/me`, () => {
        meCalls += 1;
        return HttpResponse.json(ME);
      }),
    );

    renderGuardedTree("/");

    expect(await screen.findByText("login screen")).toBeInTheDocument();
    expect(meCalls).toBe(0);
  });

  test("renders the protected content once /me resolves", async () => {
    server.use(msw.get(`${API}/me`, () => HttpResponse.json(ME)));
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderGuardedTree("/");

    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });

  test("falls back to login when /me cannot be recovered", async () => {
    server.use(
      msw.get(`${API}/me`, () => HttpResponse.json({ message: "Autenticação necessária" }, { status: 401 })),
      msw.post(`${API}/sessions/refresh`, () => HttpResponse.json({ message: "Token inválido" }, { status: 401 })),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderGuardedTree("/");

    await waitFor(() => expect(screen.getByText("login screen")).toBeInTheDocument());
  });
});
