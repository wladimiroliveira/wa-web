import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { RecipeFormPage } from "@/features/recipes/RecipeFormPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const RECIPE_ID = "44444444-4444-4444-8444-444444444444";
const FLOUR_ID = "33333333-3333-4333-8333-333333333333";
const EGG_ID = "55555555-5555-4555-8555-555555555555";

const flour = {
  id: FLOUR_ID,
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

const egg = { ...flour, id: EGG_ID, name: "Ovo", purchaseUnit: "UN", purchaseQty: 30, purchasePrice: 18 };

function renderForm(route: string, supplies: unknown[] = [flour, egg]) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["RECIPES_READ", "RECIPES_WRITE", "SUPPLIES_READ"],
      }),
    ),
    msw.get(`${API}/supplies`, () => HttpResponse.json(supplies)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id" element={<RecipeFormPage />} />
        <Route path="/recipes" element={<p>lista de receitas</p>} />
        <Route path="/supplies/new" element={<p>novo insumo</p>} />
      </Routes>
    </>,
    { route },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RecipeFormPage — creating", () => {
  test("posts the header and the items in one body, with the margin as a fraction", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/recipes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: RECIPE_ID }, { status: 201 });
      }),
    );
    renderForm("/recipes/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Coxinha");
    await userEvent.type(screen.getByLabelText(/rendimento/i), "100");
    await userEvent.type(screen.getByLabelText(/mão de obra/i), "12");
    await userEvent.type(screen.getByLabelText(/margem/i), "35");

    await userEvent.click(screen.getByRole("button", { name: /adicionar insumo/i }));
    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 1/i), FLOUR_ID);
    await userEvent.type(screen.getByLabelText(/quantidade do item 1/i), "5");
    await userEvent.selectOptions(screen.getByLabelText(/unidade do item 1/i), "KG");

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("lista de receitas")).toBeInTheDocument();
    expect(body).toEqual({
      name: "Coxinha",
      batchYield: 100,
      laborCostPerHundred: 12,
      margin: 0.35,
      items: [{ supplyId: FLOUR_ID, usageQty: 5, usageUnit: "KG" }],
    });
  });

  // The API rejects an empty `items` with a 400. The screen says so before the
  // round trip, and the message is the one the API's own Zod implies.
  test("refuses to submit with no item and does not call the API", async () => {
    let called = false;
    server.use(
      msw.post(`${API}/recipes`, () => {
        called = true;
        return HttpResponse.json({ id: RECIPE_ID }, { status: 201 });
      }),
    );
    renderForm("/recipes/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Coxinha");
    await userEvent.type(screen.getByLabelText(/rendimento/i), "100");
    await userEvent.type(screen.getByLabelText(/mão de obra/i), "12");
    await userEvent.type(screen.getByLabelText(/margem/i), "35");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/adicione ao menos um insumo/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  test("removing the last row leaves the screen usable", async () => {
    renderForm("/recipes/new");

    await userEvent.click(await screen.findByRole("button", { name: /adicionar insumo/i }));
    await userEvent.click(screen.getByRole("button", { name: /remover item 1/i }));

    expect(screen.queryByLabelText(/insumo do item 1/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adicionar insumo/i })).toBeInTheDocument();
  });

  // The API's Zod is `nonnegative` on both: a recipe with no labor allocated
  // exists, and a zero margin sells at cost. Blank is not zero, though —
  // `Number("")` is 0, and the field must fail as unanswered instead.
  test("accepts zero labor and zero margin, and refuses both blank", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/recipes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: RECIPE_ID }, { status: 201 });
      }),
    );
    renderForm("/recipes/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Coxinha");
    await userEvent.type(screen.getByLabelText(/rendimento/i), "100");
    await userEvent.click(screen.getByRole("button", { name: /adicionar insumo/i }));
    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 1/i), FLOUR_ID);
    await userEvent.type(screen.getByLabelText(/quantidade do item 1/i), "5");

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    expect(await screen.findByText(/informe a mão de obra/i)).toBeInTheDocument();
    expect(body).toBeUndefined();

    await userEvent.type(screen.getByLabelText(/mão de obra/i), "0");
    await userEvent.type(screen.getByLabelText(/margem/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("lista de receitas")).toBeInTheDocument();
    expect(body).toMatchObject({ laborCostPerHundred: 0, margin: 0 });
  });

  // The API needs at least one item and the select would be empty: a form that
  // can only fail is not offered.
  test("invites registering a supply when there is none", async () => {
    renderForm("/recipes/new", []);

    expect(await screen.findByText(/cadastre um insumo antes de criar uma receita/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cadastrar insumo/i })).toBeInTheDocument();
  });
});

describe("RecipeFormPage — the item rules", () => {
  // Flour is bought in KG (WEIGHT), so the row may only offer g and kg. The API
  // would answer 400 for a COUNT unit under a WEIGHT supply.
  test("the unit select only offers the units of the supply's dimension", async () => {
    renderForm("/recipes/new");

    await userEvent.click(await screen.findByRole("button", { name: /adicionar insumo/i }));
    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 1/i), FLOUR_ID);

    const unitOptions = Array.from(screen.getByLabelText(/unidade do item 1/i).querySelectorAll("option")).map(
      (option) => option.value,
    );

    expect(unitOptions).toEqual(["G", "KG"]);
  });

  test("switching the supply to another dimension resets the row's unit", async () => {
    renderForm("/recipes/new");

    await userEvent.click(await screen.findByRole("button", { name: /adicionar insumo/i }));
    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 1/i), FLOUR_ID);
    await userEvent.selectOptions(screen.getByLabelText(/unidade do item 1/i), "G");
    expect(screen.getByLabelText(/unidade do item 1/i)).toHaveValue("G");

    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 1/i), EGG_ID);

    expect(screen.getByLabelText(/unidade do item 1/i)).toHaveValue("UN");
  });

  // The API accepts the duplicate and `calculatePricing` sums both rows. Two
  // rows of the same supply in one batch have no useful reading: 5 kg and 300 g
  // of flour are 5,3 kg.
  test("refuses the same supply twice and does not call the API", async () => {
    let called = false;
    server.use(
      msw.post(`${API}/recipes`, () => {
        called = true;
        return HttpResponse.json({ id: RECIPE_ID }, { status: 201 });
      }),
    );
    renderForm("/recipes/new");

    await userEvent.type(await screen.findByLabelText(/nome/i), "Coxinha");
    await userEvent.type(screen.getByLabelText(/rendimento/i), "100");
    await userEvent.type(screen.getByLabelText(/mão de obra/i), "12");
    await userEvent.type(screen.getByLabelText(/margem/i), "35");

    await userEvent.click(screen.getByRole("button", { name: /adicionar insumo/i }));
    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 1/i), FLOUR_ID);
    await userEvent.type(screen.getByLabelText(/quantidade do item 1/i), "5");

    await userEvent.click(screen.getByRole("button", { name: /adicionar insumo/i }));
    await userEvent.selectOptions(screen.getByLabelText(/insumo do item 2/i), FLOUR_ID);
    await userEvent.type(screen.getByLabelText(/quantidade do item 2/i), "300");

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/este insumo já está na receita/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });
});

const recipeDetail = {
  id: RECIPE_ID,
  name: "Coxinha",
  batchYield: 100,
  laborCostPerHundred: 12,
  margin: 0.35,
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
  items: [
    { id: "item-1", recipeId: RECIPE_ID, supplyId: FLOUR_ID, usageQty: 5, usageUnit: "KG", supply: flour },
    { id: "item-2", recipeId: RECIPE_ID, supplyId: EGG_ID, usageQty: 12, usageUnit: "UN", supply: egg },
  ],
};

describe("RecipeFormPage — editing", () => {
  test("opens with the header and the items, with the margin already as a percentage", async () => {
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}`, () => HttpResponse.json(recipeDetail)));
    renderForm(`/recipes/${RECIPE_ID}`);

    expect(await screen.findByLabelText(/nome/i)).toHaveValue("Coxinha");
    expect(screen.getByLabelText(/rendimento/i)).toHaveValue(100);
    expect(screen.getByLabelText(/mão de obra/i)).toHaveValue(12);
    expect(screen.getByLabelText(/margem/i)).toHaveValue(35);
    expect(screen.getByLabelText(/insumo do item 1/i)).toHaveValue(FLOUR_ID);
    expect(screen.getByLabelText(/quantidade do item 2/i)).toHaveValue(12);
  });

  // `items` replaces the whole set on the API's side. Sending only the row that
  // changed would delete the others.
  test("saving patches the whole set of items, not only what changed", async () => {
    let body: unknown;
    server.use(
      msw.get(`${API}/recipes/${RECIPE_ID}`, () => HttpResponse.json(recipeDetail)),
      msw.patch(`${API}/recipes/${RECIPE_ID}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...recipeDetail, items: [] });
      }),
    );
    renderForm(`/recipes/${RECIPE_ID}`);

    const quantity = await screen.findByLabelText(/quantidade do item 1/i);
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "6");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("lista de receitas")).toBeInTheDocument();
    expect(body).toEqual({
      name: "Coxinha",
      batchYield: 100,
      laborCostPerHundred: 12,
      margin: 0.35,
      items: [
        { supplyId: FLOUR_ID, usageQty: 6, usageUnit: "KG" },
        { supplyId: EGG_ID, usageQty: 12, usageUnit: "UN" },
      ],
    });
  });
});
