import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { SupplyFormPage } from "@/features/supplies/SupplyFormPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const supply = {
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

function renderForm(route: string) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["SUPPLIES_READ", "SUPPLIES_WRITE"],
      }),
    ),
    msw.get(`${API}/supplies/${supply.id}`, () => HttpResponse.json(supply)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/supplies/new" element={<SupplyFormPage />} />
        <Route path="/supplies/:id" element={<SupplyFormPage />} />
        <Route path="/supplies" element={<p>lista de insumos</p>} />
      </Routes>
    </>,
    { route },
  );
}

beforeEach(() => {
  clearSession();
});

describe("SupplyFormPage", () => {
  test("creating posts the five fields and goes back to the list", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(supply, { status: 201 });
      }),
    );
    renderForm("/supplies/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Farinha de trigo");
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "INGREDIENT");
    await userEvent.selectOptions(screen.getByLabelText(/unidade de compra/i), "KG");
    await userEvent.type(screen.getByLabelText(/quantidade/i), "5");
    await userEvent.type(screen.getByLabelText(/preço/i), "24");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("lista de insumos")).toBeInTheDocument();
    expect(body).toEqual({
      name: "Farinha de trigo",
      type: "INGREDIENT",
      purchaseUnit: "KG",
      purchaseQty: 5,
      purchasePrice: 24,
    });
  });

  // The API's Zod says `purchasePrice: nonnegative`, so free is valid, and
  // `purchaseQty: positive`, so zero is not.
  test("accepts a price of zero and refuses a quantity of zero before sending", async () => {
    let called = false;
    server.use(
      msw.post(`${API}/supplies`, () => {
        called = true;
        return HttpResponse.json(supply, { status: 201 });
      }),
    );
    renderForm("/supplies/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Doação");
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "INGREDIENT");
    await userEvent.selectOptions(screen.getByLabelText(/unidade de compra/i), "KG");
    await userEvent.type(screen.getByLabelText(/quantidade/i), "0");
    await userEvent.type(screen.getByLabelText(/preço/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/informe uma quantidade maior que zero/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  // `z.coerce.number()` runs `Number("")`, which is `0` — a blank field must
  // not silently become a free supply. A later slice prices recipes from
  // `purchasePrice`, so a forgotten price would make every recipe using this
  // supply look cheaper than it is, with no error anywhere.
  test("refuses a blank purchase price before sending", async () => {
    let called = false;
    server.use(
      msw.post(`${API}/supplies`, () => {
        called = true;
        return HttpResponse.json(supply, { status: 201 });
      }),
    );
    renderForm("/supplies/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Farinha de trigo");
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "INGREDIENT");
    await userEvent.selectOptions(screen.getByLabelText(/unidade de compra/i), "KG");
    await userEvent.type(screen.getByLabelText(/quantidade/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/informe o preço/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  // Zero stays valid, but only as something a person types, not something a
  // blank field decides for them.
  test("accepts a typed zero price and sends it as zero", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(supply, { status: 201 });
      }),
    );
    renderForm("/supplies/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Farinha de trigo");
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "INGREDIENT");
    await userEvent.selectOptions(screen.getByLabelText(/unidade de compra/i), "KG");
    await userEvent.type(screen.getByLabelText(/quantidade/i), "5");
    await userEvent.type(screen.getByLabelText(/preço/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("lista de insumos")).toBeInTheDocument();
    expect(body).toMatchObject({ purchasePrice: 0 });
  });

  test("editing opens with the supply's values and sends a PATCH", async () => {
    let method: string | undefined;
    let body: unknown;
    server.use(
      msw.patch(`${API}/supplies/${supply.id}`, async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json(supply);
      }),
    );
    renderForm(`/supplies/${supply.id}`);

    expect(await screen.findByLabelText(/nome/i)).toHaveValue("Farinha de trigo");
    expect(screen.getByLabelText(/unidade de compra/i)).toHaveValue("KG");

    await userEvent.clear(screen.getByLabelText(/preço/i));
    await userEvent.type(screen.getByLabelText(/preço/i), "26");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("lista de insumos")).toBeInTheDocument();
    expect(method).toBe("PATCH");
    expect(body).toMatchObject({ purchasePrice: 26 });
  });

  test("the purchase unit offers all five units — the choice is what declares the dimension", async () => {
    renderForm("/supplies/new");

    const options = await screen.findAllByRole("option", { name: /^(g|kg|ml|l|un)$/i });

    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual(["G", "KG", "ML", "L", "UN"]);
  });

  test("a failure the form cannot fix becomes a toast", async () => {
    server.use(msw.post(`${API}/supplies`, () => HttpResponse.json({ message: "Erro interno" }, { status: 500 })));
    renderForm("/supplies/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Farinha de trigo");
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "INGREDIENT");
    await userEvent.selectOptions(screen.getByLabelText(/unidade de compra/i), "KG");
    await userEvent.type(screen.getByLabelText(/quantidade/i), "5");
    await userEvent.type(screen.getByLabelText(/preço/i), "24");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("Erro interno")).toBeInTheDocument();
  });
});
