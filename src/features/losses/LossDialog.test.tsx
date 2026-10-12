import { HttpResponse, http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LossDialog } from "@/features/losses/LossDialog";
import { stockKeys } from "@/features/stock/stock.api";
import { stockMovementsKeys } from "@/features/stock-movements/stock-movements.api";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aLoss, aLossReason, aStockLot, aStockPosition } from "@/tests/samples";

const LOT = aStockLot({ id: "lot-1", quantity: "10", expiresAt: "2026-10-01" });

function withReasons() {
  server.use(
    http.get(apiUrl("/loss-reasons"), () =>
      HttpResponse.json([
        aLossReason({ id: "reason-1", name: "Vencimento" }),
        aLossReason({ id: "reason-2", name: "Quebra", isActive: false }),
      ]),
    ),
  );
}

const dialog = (onOpenChange: (open: boolean) => void = () => undefined) => (
  <LossDialog lot={LOT} unit="KILOGRAM" productName="Farinha de trigo" onOpenChange={onOpenChange} />
);

async function fill(quantity: string) {
  // The field is on screen before the reasons arrive; choosing has to wait for them.
  await screen.findByRole("option", { name: "Vencimento" });
  await userEvent.selectOptions(screen.getByLabelText("Modalidade"), "Vencimento");
  await userEvent.type(screen.getByLabelText("Quantidade"), quantity);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Registrar avaria" }));

describe("LossDialog", () => {
  it("says which lot is being written off and how much it holds", async () => {
    withReasons();

    renderWithProviders(dialog());

    expect(await screen.findByText(/Farinha de trigo/)).toBeInTheDocument();
    expect(screen.getByText(/validade 01\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/saldo de 10 kg/)).toBeInTheDocument();
  });

  it("offers only the reasons in use", async () => {
    withReasons();

    renderWithProviders(dialog());

    expect(await screen.findByRole("option", { name: "Vencimento" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Quebra" })).not.toBeInTheDocument();
  });

  it("refuses a loss with no reason, no quantity, or more than the lot holds", async () => {
    withReasons();

    renderWithProviders(dialog());

    await screen.findByRole("option", { name: "Vencimento" });
    await submit();

    expect(await screen.findByText("Escolha a modalidade.")).toBeInTheDocument();
    expect(screen.getByText("Informe a quantidade, com até 6 casas decimais.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Quantidade"), "10,5");
    await submit();

    expect(await screen.findByText("A quantidade não pode passar do saldo do lote.")).toBeInTheDocument();
  });

  it("records the loss with a decimal point and the note, and closes", async () => {
    withReasons();
    const onOpenChange = vi.fn();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/losses"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aLoss(), { status: 201 });
      }),
    );

    renderWithProviders(dialog(onOpenChange));
    await fill("2,5");
    await userEvent.type(screen.getByLabelText("Observação (opcional)"), "Saco rasgado.");
    await submit();

    await waitFor(() =>
      expect(received).toEqual({ lotId: "lot-1", reasonId: "reason-1", quantity: "2.5", note: "Saco rasgado." }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves the note out of the request when none was typed", async () => {
    withReasons();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/losses"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aLoss(), { status: 201 });
      }),
    );

    renderWithProviders(dialog());
    await fill("10");
    await submit();

    await waitFor(() => expect(received).toEqual({ lotId: "lot-1", reasonId: "reason-1", quantity: "10" }));
  });

  it("says the lot no longer holds that much, in Portuguese, and stays open", async () => {
    withReasons();
    const onOpenChange = vi.fn();
    server.use(http.post(apiUrl("/losses"), () => HttpResponse.json({ message: "Too much." }, { status: 409 })));

    renderWithProviders(dialog(onOpenChange));
    await fill("2");
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O lote já não tem esse saldo ou a modalidade foi inativada. Atualize a página.",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("drops the cached stock and movement history after a loss, so both show it", async () => {
    withReasons();
    server.use(http.post(apiUrl("/losses"), () => HttpResponse.json(aLoss(), { status: 201 })));
    const queryClient = new QueryClient();
    queryClient.setQueryData(stockKeys.all, aStockPosition());
    queryClient.setQueryData(stockMovementsKeys.list(undefined), { pages: [], pageParams: [] });
    const onOpenChange = vi.fn();

    render(<QueryClientProvider client={queryClient}>{dialog(onOpenChange)}</QueryClientProvider>);
    await fill("1");
    await submit();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(queryClient.getQueryState(stockKeys.all)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(stockMovementsKeys.list(undefined))?.isInvalidated).toBe(true);
  });
});
