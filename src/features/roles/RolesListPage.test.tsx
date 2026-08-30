import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
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
});
