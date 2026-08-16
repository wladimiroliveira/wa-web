import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { useLogout } from "@/features/auth/use-logout";
import { clearSession, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

function LogoutButton() {
  const logout = useLogout();
  return (
    <button type="button" onClick={() => logout.mutate()}>
      Sair
    </button>
  );
}

function renderLogout() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<LogoutButton />} />
      <Route path="/login" element={<p>login screen</p>} />
    </Routes>,
    { route: "/" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("useLogout", () => {
  test("clears the session and lands on the login screen", async () => {
    server.use(msw.delete(`${API}/sessions`, () => new HttpResponse(null, { status: 204 })));
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderLogout();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("login screen")).toBeInTheDocument();
    expect(getRefreshToken()).toBeNull();
  });

  test("still logs out when the API cannot be reached", async () => {
    server.use(msw.delete(`${API}/sessions`, () => HttpResponse.error()));
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    renderLogout();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("login screen")).toBeInTheDocument();
    expect(getRefreshToken()).toBeNull();
  });

  test("empties the query cache so no stale data survives into the next session", async () => {
    server.use(msw.delete(`${API}/sessions`, () => new HttpResponse(null, { status: 204 })));
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    const { queryClient } = renderLogout();
    queryClient.setQueryData(["me"], { id: "stale" });

    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    await screen.findByText("login screen");
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
  });
});
