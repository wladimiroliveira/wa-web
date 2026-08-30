import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "@/features/auth/use-session";
import { getRefreshToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aSessionTokens } from "@/tests/samples";

function SessionProbe() {
  const { status, user, can, signIn, signOut } = useSession();

  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.name ?? "none"}</p>
      <p data-testid="can-read">{String(can("ACCESS_READ"))}</p>
      <button onClick={() => void signIn({ username: "operador", password: "secret123" })}>entrar</button>
      <button onClick={() => void signOut()}>sair</button>
    </div>
  );
}

describe("SessionProvider", () => {
  it("is anonymous with no stored session, and asks the API nothing", async () => {
    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });

  it("rehydrates a stored session on boot", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ name: "Ana" }))));

    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("Ana");
  });

  it("falls back to anonymous when the stored refresh token is no longer accepted", async () => {
    setRefreshToken("revoked");
    server.use(
      http.get(apiUrl("/sessions/me"), () =>
        HttpResponse.json({ message: "Authentication required." }, { status: 401 }),
      ),
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });

  it("stores the pair and loads the user when signing in", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json(aSessionTokens({ refreshToken: "refresh-new" }))),
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ name: "Ana" }))),
    );

    renderWithProviders(<SessionProbe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    await userEvent.click(screen.getByRole("button", { name: "entrar" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(getRefreshToken()).toBe("refresh-new");
  });

  it("answers what the user may do, from the permissions the API returned", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
    );

    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("can-read")).toHaveTextContent("true"));
  });

  it("clears the session locally even when revoking it on the API fails", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())),
      http.post(apiUrl("/sessions/signout"), () => new HttpResponse(null, { status: 502 })),
    );

    renderWithProviders(<SessionProbe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await userEvent.click(screen.getByRole("button", { name: "sair" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(getRefreshToken()).toBeNull();
  });
});
