import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { ApiError } from "@/lib/http";
import { renderWithProviders } from "@/tests/render";

describe("QueryErrorState", () => {
  test("shows the API message when there is one — it already comes in Portuguese", () => {
    renderWithProviders(<QueryErrorState error={new ApiError(500, "O servidor tropeçou")} onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("O servidor tropeçou");
  });

  test("falls back to a generic message when the failure carries none", () => {
    renderWithProviders(<QueryErrorState error={new TypeError("Failed to fetch")} onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });

  test("retrying calls back, so the button is not decoration", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<QueryErrorState error={new ApiError(0, "Sem conexão")} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
