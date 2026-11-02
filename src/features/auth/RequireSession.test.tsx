import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequireSession } from "@/features/auth/RequireSession";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { navigation } from "@/tests/navigation";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

function renderGuarded(route: string) {
  return renderWithProviders(
    <RequireSession>
      <p>Papéis</p>
    </RequireSession>,
    { route },
  );
}

describe("RequireSession", () => {
  it("sends an anonymous visitor to the sign-in screen, remembering where they were going", async () => {
    renderGuarded("/roles");

    await waitFor(() => expect(navigation.url).toBe("/login?from=%2Froles"));
    expect(screen.queryByText("Papéis")).not.toBeInTheDocument();
  });

  it("lets a signed-in operator through", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())));

    renderGuarded("/roles");

    expect(await screen.findByText("Papéis")).toBeInTheDocument();
  });
});
