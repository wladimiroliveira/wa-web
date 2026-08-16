import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { StockEntryDialog } from "@/features/stock/StockEntryDialog";
import type { Supply } from "@/features/supplies/supplies.api";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const flour: Supply = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

const box: Supply = { ...flour, id: "55555555-5555-4555-8555-555555555555", name: "Caixa", purchaseUnit: "UN" };

const movement = {
  id: "44444444-4444-4444-8444-444444444444",
  supplyId: flour.id,
  type: "ENTRY",
  quantityBase: 5000,
  reason: null,
  note: null,
  productionId: null,
  createdAt: "2026-08-16T12:00:00.000Z",
};

function renderDialog(supply: Supply) {
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <StockEntryDialog supply={supply} onOpenChange={() => {}} />
    </>,
  );
}

beforeEach(() => {
  clearSession();
});

describe("StockEntryDialog", () => {
  // The API refuses an entry whose unit is of another dimension than the
  // supply's. Offering only the compatible ones puts that error out of reach.
  test("offers only the units of the supply's dimension", async () => {
    renderDialog(flour);

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual(["G", "KG"]);
  });

  test("a counted supply offers only its own unit", async () => {
    renderDialog(box);

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual(["UN"]);
  });

  test("sends the quantity and unit raw, and reports the new balance", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies/${flour.id}/stock-entries`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ movement, currentStock: 17500 }, { status: 201 });
      }),
    );
    renderDialog(flour);

    await userEvent.type(await screen.findByLabelText(/quantidade/i), "5");
    await userEvent.selectOptions(screen.getByLabelText(/unidade/i), "KG");
    await userEvent.type(screen.getByLabelText(/observação/i), "Nota 123");
    await userEvent.click(screen.getByRole("button", { name: /lançar entrada/i }));

    expect(await screen.findByText(/17,5 kg/)).toBeInTheDocument();
    expect(body).toEqual({ quantity: 5, unit: "KG", note: "Nota 123" });
  });

  test("omits the note when it was left empty", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      msw.post(`${API}/supplies/${flour.id}/stock-entries`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ movement, currentStock: 20000 }, { status: 201 });
      }),
    );
    renderDialog(flour);

    await userEvent.type(await screen.findByLabelText(/quantidade/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /lançar entrada/i }));

    expect(await screen.findByText(/20 kg/)).toBeInTheDocument();
    expect(body).not.toHaveProperty("note");
  });

  test("refuses a quantity of zero before sending", async () => {
    let called = false;
    server.use(
      msw.post(`${API}/supplies/${flour.id}/stock-entries`, () => {
        called = true;
        return HttpResponse.json({ movement, currentStock: 17500 }, { status: 201 });
      }),
    );
    renderDialog(flour);

    await userEvent.type(await screen.findByLabelText(/quantidade/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /lançar entrada/i }));

    expect(await screen.findByText(/informe uma quantidade maior que zero/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  test("closes on success", async () => {
    const onOpenChange = vi.fn();
    server.use(
      msw.post(`${API}/supplies/${flour.id}/stock-entries`, () =>
        HttpResponse.json({ movement, currentStock: 25000 }, { status: 201 }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");
    renderWithProviders(
      <>
        <Toaster />
        <StockEntryDialog supply={flour} onOpenChange={onOpenChange} />
      </>,
    );

    await userEvent.type(await screen.findByLabelText(/quantidade/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /lançar entrada/i }));

    expect(await screen.findByText(/25 kg/)).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("a failure the dialog cannot fix becomes a toast", async () => {
    server.use(
      msw.post(`${API}/supplies/${flour.id}/stock-entries`, () =>
        HttpResponse.json({ message: "Erro interno" }, { status: 500 }),
      ),
    );
    renderDialog(flour);

    await userEvent.type(await screen.findByLabelText(/quantidade/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /lançar entrada/i }));

    expect(await screen.findByText("Erro interno")).toBeInTheDocument();
  });
});
