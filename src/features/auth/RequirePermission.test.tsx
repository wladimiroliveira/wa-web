import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { request } from "@/lib/http";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

/** Stands in for a real screen: mounting it is what would hit the API. */
function GuardedScreen() {
  const query = useQuery({ queryKey: ["roles"], queryFn: () => request("/roles") });

  return <p>{query.isSuccess ? "Papéis carregados" : "Carregando"}</p>;
}

describe("RequirePermission", () => {
  it("renders 403 instead of the screen, and never mounts it", async () => {
    setRefreshToken("refresh-one");
    let roleCalls = 0;
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
      http.get(apiUrl("/roles"), () => {
        roleCalls += 1;
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(
      <Routes>
        <Route element={<RequirePermission permission="ACCESS_READ" />}>
          <Route path="/roles" element={<GuardedScreen />} />
        </Route>
      </Routes>,
      { route: "/roles" },
    );

    expect(await screen.findByText("Você não tem permissão para ver esta tela.")).toBeInTheDocument();
    expect(screen.queryByText("Carregando")).not.toBeInTheDocument();
    expect(roleCalls).toBe(0);
  });

  it("renders the screen when the permission is there", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
      http.get(apiUrl("/roles"), () => HttpResponse.json([])),
    );

    renderWithProviders(
      <Routes>
        <Route element={<RequirePermission permission="ACCESS_READ" />}>
          <Route path="/roles" element={<GuardedScreen />} />
        </Route>
      </Routes>,
      { route: "/roles" },
    );

    await waitFor(() => expect(screen.getByText("Papéis carregados")).toBeInTheDocument());
  });
});
