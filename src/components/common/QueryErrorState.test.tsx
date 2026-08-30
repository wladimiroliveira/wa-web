import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { ApiError } from "@/lib/http";

describe("QueryErrorState", () => {
  it("shows a way out, not just a dead end", async () => {
    const onRetry = vi.fn();
    render(<QueryErrorState error={new ApiError(502, null)} onRetry={onRetry} />);

    expect(screen.getByText("Não foi possível concluir a operação. Tente de novo.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
