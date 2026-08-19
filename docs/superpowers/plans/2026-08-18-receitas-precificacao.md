# Receitas e Precificação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o cadastro de receitas com seus itens e a tela que responde por quanto vender o cento.

**Architecture:** Um módulo, `features/recipes`, com três telas em rota própria sobre a fundação das fatias anteriores.
O formulário é composto — cabeçalho e itens numa submissão só, porque é assim que a API os aceita — e o preço vive em
rota separada porque a permissão é outra. A regra que não cabe em nenhuma tela, a conversão da margem entre fração e
percentual, sai para um módulo próprio com teste.

**Tech Stack:** React 19, TypeScript, React Router v7, TanStack Query v5, react-hook-form + Zod 4, Tailwind v4,
shadcn/ui (primitivas `@base-ui/react`), Vitest, Testing Library, MSW.

**Spec:** [docs/superpowers/specs/2026-08-18-receitas-precificacao-design.md](../specs/2026-08-18-receitas-precificacao-design.md)

## Global Constraints

- **Idioma:** identificadores, arquivos, testes e comentários em inglês. Português só no texto que a pessoa lê na tela.
- **Segmento de URL é identificador:** `/recipes/new`, nunca `/receitas/nova`.
- **TDD sem exceção:** teste vermelho primeiro, com a saída da falha colada, antes de qualquer implementação.
- **Commits:** um commit por tarefa, só no branch `feat/recipes-pricing`. Nada de push, nada de PR, nada na `main`. O
  usuário **ainda não autorizou** os commits desta fatia: peça a autorização antes da Task 1. Sem ela, cada tarefa
  termina com o trabalho na árvore e a saída da suíte colada, e o passo de commit fica pendente.
- **Prettier:** 120 colunas, aspas duplas, ponto e vírgula, `trailingComma: all`. Rodar `npm run lint:prettier:fix`
  antes de fechar cada tarefa. `docs/` e `src/lib/api.types.ts` estão no `.prettierignore`.
- **MSW roda com `onUnhandledRequest: "error"`:** todo endpoint que a tela chama precisa de handler no teste, inclusive
  `GET /me`. Uma requisição não prevista falha o teste.
- **Nenhuma trava de segurança no front end.** Se a API permite, a tela permite. Achado de back end vira issue no
  `wa-api`, não trava aqui.
- **API base nos testes:** `http://localhost:3333`, o valor de `VITE_API_URL` em `.env.test`.
- **Tipos vêm de `@/lib/api.types`**, sempre derivados de `paths`. Nenhum contrato redigitado à mão. Não há regeneração
  nesta fatia: o arquivo já descreve as quatro rotas de receita.
- **A margem trafega em fração para a API e em percentual na tela.** Nenhum componente multiplica ou divide por 100 à
  mão: `toPercent` e `fromPercent` são o único caminho.
- **Rodar a suíte inteira ao fim de cada tarefa** (`npm run test`), não só o arquivo da tarefa.

---

### Task 1: A conversão da margem

A API guarda `margin` como fração — `0.35` é 35 %. A tela nunca mostra fração. Esta tarefa entrega a tradução entre as
duas, isolada e testada, antes de qualquer tela que dependa dela.

O motivo de ser módulo e não duas linhas dentro do formulário: a conversão aparece em dois lugares — o formulário, que
converte nos dois sentidos, e a tela de preço, que converte para exibir.

**Files:**

- Create: `src/features/recipes/margin.ts`
- Test: `src/features/recipes/margin.test.ts`

**Interfaces:**

- Consumes: nada
- Produces: `toPercent(fraction: number): number` e `fromPercent(percent: number): number`

- [ ] **Step 1: Write the failing test**

Criar `src/features/recipes/margin.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { fromPercent, toPercent } from "@/features/recipes/margin";

describe("margin", () => {
  // `0.35 * 100` is 35.000000000000004 in JavaScript. A field that opens with
  // that value is wrong on its face, so multiplying is what needs rounding.
  test("toPercent converts the fraction without a floating-point tail", () => {
    expect(toPercent(0.35)).toBe(35);
    expect(toPercent(0.1)).toBe(10);
    expect(toPercent(0.07)).toBe(7);
  });

  test("toPercent keeps one decimal place", () => {
    expect(toPercent(0.335)).toBe(33.5);
  });

  test("the two are inverses over the values the screen produces", () => {
    for (const fraction of [0, 0.05, 0.35, 1, 1.5]) {
      expect(fromPercent(toPercent(fraction))).toBe(fraction);
    }
  });

  // What travels to the API is the serialized number, so that is what the test
  // asserts: dividing lands on the nearest double to 0.35, which prints as 0.35.
  test("fromPercent serializes as the fraction the API expects", () => {
    expect(JSON.stringify(fromPercent(35))).toBe("0.35");
    expect(JSON.stringify(fromPercent(0))).toBe("0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/margin.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/recipes/margin"`.

- [ ] **Step 3: Write minimal implementation**

Criar `src/features/recipes/margin.ts`:

```ts
/**
 * The API stores `margin` as a fraction: `0.35` prices at cost × 1,35. The
 * screen never shows one. `nonnegative` has no ceiling on the server, so a raw
 * field that accepts `35` stores a 3500 % margin and prices a hundred at forty
 * times its cost without a single error anywhere.
 *
 * Multiplying is what needs rounding — `0.35 * 100` is 35.000000000000004.
 * Dividing does not: `35 / 100` is the nearest double to 0.35, which is exactly
 * what `JSON.stringify` writes as `0.35`.
 */
export function toPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

export function fromPercent(percent: number): number {
  return percent / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/recipes/margin.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Format and run the whole suite**

Run: `npm run lint:prettier:fix && npm run test`
Expected: PASS, sem regressão.

- [ ] **Step 6: Commit**

```bash
git add src/features/recipes/margin.ts src/features/recipes/margin.test.ts
git commit -m "feat(recipes): convert margin between fraction and percentage"
```

---

### Task 2: A camada de API e as queries

Seis chamadas e quatro hooks. Nenhuma tela ainda — esta tarefa entrega o acesso ao contrato, testado contra o MSW,
para que as tarefas seguintes só cuidem de tela.

**Files:**

- Create: `src/features/recipes/recipes.api.ts`
- Create: `src/features/recipes/use-recipes.ts`
- Create: `src/features/recipes/use-recipe.ts`
- Create: `src/features/recipes/use-recipe-pricing.ts`
- Create: `src/features/recipes/use-recipe-mutations.ts`
- Test: `src/features/recipes/recipes.api.test.ts`

**Interfaces:**

- Consumes: `request` de `@/lib/http`, `paths` de `@/lib/api.types`
- Produces:
  - Tipos: `Recipe`, `RecipeDetail`, `RecipeDetailItem`, `RecipeWithItems`, `RecipePricing`, `CreateRecipeInput`,
    `UpdateRecipeInput`
  - Funções: `fetchRecipes()`, `fetchRecipe(id)`, `fetchRecipePricing(id)`, `createRecipe(input)`,
    `updateRecipe(id, input)`, `deleteRecipe(id)`
  - Hooks: `useRecipes()`, `useRecipe(id?)`, `useRecipePricing(id?)`, `useCreateRecipe()`, `useUpdateRecipe(id)`,
    `useDeleteRecipe()`, `useInvalidateRecipes()`
  - Chaves: `RECIPES_QUERY_KEY = ["recipes"]`, `recipeQueryKey(id) = ["recipes", id]`,
    `recipePricingQueryKey(id) = ["recipes", id, "pricing"]`

- [ ] **Step 1: Write the failing test**

Criar `src/features/recipes/recipes.api.test.ts`:

```ts
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipePricing,
  fetchRecipes,
  updateRecipe,
} from "@/features/recipes/recipes.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const RECIPE_ID = "44444444-4444-4444-8444-444444444444";
const SUPPLY_ID = "33333333-3333-4333-8333-333333333333";

const recipe = {
  id: RECIPE_ID,
  name: "Coxinha",
  batchYield: 100,
  laborCostPerHundred: 12,
  margin: 0.35,
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("recipes.api", () => {
  test("fetchRecipes returns the list", async () => {
    server.use(msw.get(`${API}/recipes`, () => HttpResponse.json([recipe])));

    await expect(fetchRecipes()).resolves.toEqual([recipe]);
  });

  test("fetchRecipe returns the recipe with its items", async () => {
    const detail = {
      ...recipe,
      items: [{ id: "item-1", recipeId: RECIPE_ID, supplyId: SUPPLY_ID, usageQty: 5, usageUnit: "KG" }],
    };
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}`, () => HttpResponse.json(detail)));

    await expect(fetchRecipe(RECIPE_ID)).resolves.toEqual(detail);
  });

  test("fetchRecipePricing asks the pricing route", async () => {
    const pricing = {
      suppliesCostPerHundred: 38.4,
      totalCostPerHundred: 50.4,
      exactPrice: 68.04,
      pricePerHundred: 69,
      pricePerHalfHundred: 35,
    };
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () => HttpResponse.json(pricing)));

    await expect(fetchRecipePricing(RECIPE_ID)).resolves.toEqual(pricing);
  });

  test("createRecipe posts the header and the items in one body", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/recipes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...recipe, items: [] }, { status: 201 });
      }),
    );

    await createRecipe({
      name: "Coxinha",
      batchYield: 100,
      laborCostPerHundred: 12,
      margin: 0.35,
      items: [{ supplyId: SUPPLY_ID, usageQty: 5, usageUnit: "KG" }],
    });

    expect(body).toEqual({
      name: "Coxinha",
      batchYield: 100,
      laborCostPerHundred: 12,
      margin: 0.35,
      items: [{ supplyId: SUPPLY_ID, usageQty: 5, usageUnit: "KG" }],
    });
  });

  test("updateRecipe patches by id", async () => {
    let body: unknown;
    server.use(
      msw.patch(`${API}/recipes/${RECIPE_ID}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...recipe, items: [] });
      }),
    );

    await updateRecipe(RECIPE_ID, { name: "Coxinha grande" });

    expect(body).toEqual({ name: "Coxinha grande" });
  });

  test("deleteRecipe deletes by id", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/recipes/${RECIPE_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteRecipe(RECIPE_ID);

    expect(deleted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/recipes.api.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/recipes/recipes.api"`.

- [ ] **Step 3: Write the API layer**

Criar `src/features/recipes/recipes.api.ts`:

```ts
import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type Recipe = paths["/recipes"]["get"]["responses"][200]["content"]["application/json"][number];

/** `GET /recipes/:id` nests the whole supply inside each item; POST and PATCH do not. */
export type RecipeDetail = paths["/recipes/{id}"]["get"]["responses"][200]["content"]["application/json"];
export type RecipeDetailItem = RecipeDetail["items"][number];
export type RecipeWithItems = paths["/recipes"]["post"]["responses"][201]["content"]["application/json"];

export type RecipePricing = paths["/recipes/{id}/pricing"]["get"]["responses"][200]["content"]["application/json"];

export type CreateRecipeInput = paths["/recipes"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateRecipeInput = paths["/recipes/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function fetchRecipes(): Promise<Recipe[]> {
  return request<Recipe[]>("/recipes");
}

export function fetchRecipe(id: string): Promise<RecipeDetail> {
  return request<RecipeDetail>(`/recipes/${id}`);
}

export function fetchRecipePricing(id: string): Promise<RecipePricing> {
  return request<RecipePricing>(`/recipes/${id}/pricing`);
}

export function createRecipe(input: CreateRecipeInput): Promise<RecipeWithItems> {
  return request<RecipeWithItems>("/recipes", { method: "POST", body: JSON.stringify(input) });
}

export function updateRecipe(id: string, input: UpdateRecipeInput): Promise<RecipeWithItems> {
  return request<RecipeWithItems>(`/recipes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRecipe(id: string): Promise<void> {
  return request<void>(`/recipes/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Write the query hooks**

Criar `src/features/recipes/use-recipes.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchRecipes, type Recipe } from "@/features/recipes/recipes.api";

export const RECIPES_QUERY_KEY = ["recipes"] as const;

export function useRecipes() {
  return useQuery<Recipe[]>({ queryKey: RECIPES_QUERY_KEY, queryFn: fetchRecipes });
}
```

Criar `src/features/recipes/use-recipe.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchRecipe, type RecipeDetail } from "@/features/recipes/recipes.api";

export function recipeQueryKey(id: string) {
  return ["recipes", id] as const;
}

export function useRecipe(id: string | undefined) {
  return useQuery<RecipeDetail>({
    queryKey: recipeQueryKey(id ?? ""),
    queryFn: () => fetchRecipe(id!),
    enabled: Boolean(id),
  });
}
```

Criar `src/features/recipes/use-recipe-pricing.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchRecipePricing, type RecipePricing } from "@/features/recipes/recipes.api";

export function recipePricingQueryKey(id: string) {
  return ["recipes", id, "pricing"] as const;
}

/**
 * No `retry` option: `createQueryClient` already defaults every query to
 * `retry: false`, which is what this one needs — the failure that matters here
 * is the 409 the API sends when a supply drifted to another dimension, and
 * retrying it only delays the message that says how to fix it.
 */
export function useRecipePricing(id: string | undefined) {
  return useQuery<RecipePricing>({
    queryKey: recipePricingQueryKey(id ?? ""),
    queryFn: () => fetchRecipePricing(id!),
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 5: Write the mutation hooks**

Criar `src/features/recipes/use-recipe-mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
  type CreateRecipeInput,
  type RecipeWithItems,
  type UpdateRecipeInput,
} from "@/features/recipes/recipes.api";
import { RECIPES_QUERY_KEY } from "@/features/recipes/use-recipes";

/**
 * Coarse by key hierarchy, as in the earlier slices: `["recipes"]` is a prefix
 * of `["recipes", id]` and of `["recipes", id, "pricing"]`, so one call reaches
 * the list, the detail and the price. The price matters most — changing an item
 * changes what the recipe costs, and a stale price is a wrong number on the one
 * screen that exists to give right ones.
 */
export function useInvalidateRecipes() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
  };
}

export function useCreateRecipe() {
  const invalidate = useInvalidateRecipes();

  return useMutation<RecipeWithItems, unknown, CreateRecipeInput>({
    mutationFn: createRecipe,
    onSuccess: invalidate,
  });
}

export function useUpdateRecipe(id: string) {
  const invalidate = useInvalidateRecipes();

  return useMutation<RecipeWithItems, unknown, UpdateRecipeInput>({
    mutationFn: (input) => updateRecipe(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecipe() {
  const invalidate = useInvalidateRecipes();

  return useMutation<void, unknown, string>({ mutationFn: deleteRecipe, onSuccess: invalidate });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/recipes/recipes.api.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 7: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: sem erro de tipo, PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/recipes/
git commit -m "feat(recipes): add the recipes API layer and its queries"
```

---

### Task 3: A lista de receitas

Primeira tela. Substitui o placeholder de `/recipes`.

`GET /recipes` é rasa — sem itens e sem custo — então a tabela mostra o que existe: nome, rendimento, mão de obra por
cento e margem. Não há coluna de preço: preço sai de uma rota por receita, e vinte linhas seriam vinte requisições.

**Files:**

- Create: `src/features/recipes/RecipesListPage.tsx`
- Modify: `src/app/router.tsx` (`BUILT_ROUTES` e um bloco de rotas novo)
- Test: `src/features/recipes/RecipesListPage.test.tsx`
- Test: `src/app/router.test.tsx` (a rota `/recipes` passa a resolver numa tela real)

**Interfaces:**

- Consumes: `useRecipes` (Task 2), `useDeleteRecipe` (Task 2), `toPercent` (Task 1), `formatCurrency` e
  `formatQuantity` de `@/lib/format`, `formatWithUnit` de `@/lib/unit`
- Produces: `RecipesListPage`, e a rota `/recipes` sob `RequirePermission permission="RECIPES_READ"`

- [ ] **Step 1: Write the failing test**

Criar `src/features/recipes/RecipesListPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { RecipesListPage } from "@/features/recipes/RecipesListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const RECIPE_ID = "44444444-4444-4444-8444-444444444444";

const recipe = {
  id: RECIPE_ID,
  name: "Coxinha",
  batchYield: 100,
  laborCostPerHundred: 12,
  margin: 0.35,
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
};

function renderList(permissions: string[], recipes: unknown[] = [recipe]) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions,
      }),
    ),
    msw.get(`${API}/recipes`, () => HttpResponse.json(recipes)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/recipes" element={<RecipesListPage />} />
      </Routes>
    </>,
    { route: "/recipes" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RecipesListPage", () => {
  test("shows the yield, the labor cost and the margin as a percentage", async () => {
    renderList(["RECIPES_READ", "RECIPES_WRITE", "PRICING_READ"]);

    const row = (await screen.findByText("Coxinha")).closest("tr")!;

    expect(row).toHaveTextContent("100 un");
    expect(row).toHaveTextContent("R$ 12,00");
    expect(row).toHaveTextContent("35 %");
  });

  test("says so when there is nothing registered", async () => {
    renderList(["RECIPES_READ"], []);

    expect(await screen.findByText(/nenhuma receita cadastrada/i)).toBeInTheDocument();
  });

  test("hides the write actions from a read-only reader", async () => {
    renderList(["RECIPES_READ"]);

    expect(await screen.findByText("Coxinha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /nova receita/i })).not.toBeInTheDocument();
  });

  // PRICING_READ is independent of RECIPES_READ in the API's enum: the screen
  // keeps the two apart instead of assuming one implies the other.
  test("hides the price link from whoever cannot read pricing", async () => {
    renderList(["RECIPES_READ", "RECIPES_WRITE"]);

    expect(await screen.findByText("Coxinha")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /preço/i })).not.toBeInTheDocument();
  });

  test("deleting asks first and only calls the API after confirmation", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/recipes/${RECIPE_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderList(["RECIPES_READ", "RECIPES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    expect(deleted).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir receita$/i }));

    expect(deleted).toBe(true);
  });

  // `Production.recipeId` is the only Restrict reference to Recipe in the
  // schema, so the screen can name the cause the API's generic message hides.
  test("a 409 on deletion explains that the recipe already has production", async () => {
    server.use(
      msw.delete(`${API}/recipes/${RECIPE_ID}`, () =>
        HttpResponse.json({ message: "Operação viola uma referência existente" }, { status: 409 }),
      ),
    );
    renderList(["RECIPES_READ", "RECIPES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^excluir receita$/i }));

    expect(await screen.findByText(/já tem produção registrada/i)).toBeInTheDocument();
    expect(screen.getByText("Coxinha")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/RecipesListPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/recipes/RecipesListPage"`.

- [ ] **Step 3: Write the screen**

Criar `src/features/recipes/RecipesListPage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { toPercent } from "@/features/recipes/margin";
import { useDeleteRecipe } from "@/features/recipes/use-recipe-mutations";
import { useRecipes } from "@/features/recipes/use-recipes";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { ApiError } from "@/lib/http";
import { formatWithUnit } from "@/lib/unit";

/**
 * `Production.recipeId` is the only `onDelete: Restrict` reference to `Recipe`
 * in the API's schema, so a 409 has exactly one cause. The API answers any
 * P2003 with "Operação viola uma referência existente", which tells nobody what
 * to do; the sentence below does.
 */
function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "Não é possível excluir uma receita que já tem produção registrada.";
  }
  if (error instanceof ApiError) return error.message;
  return "Não foi possível excluir. Verifique sua conexão.";
}

export function RecipesListPage() {
  const recipes = useRecipes();
  const deleteRecipe = useDeleteRecipe();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "RECIPES_WRITE");
  const canReadPricing = hasPermission(me?.permissions ?? [], "PRICING_READ");
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (recipes.isError) return <QueryErrorState error={recipes.error} onRetry={() => void recipes.refetch()} />;
  if (!recipes.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  function onConfirmDelete() {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    deleteRecipe.mutate(id, { onError: (error) => toast.error(toastMessageFor(error)) });
  }

  return (
    <section className="p-8">
      <PageHeader title="Receitas">
        {canWrite && (
          <Link to="/recipes/new" className={buttonVariants({ size: "sm" })}>
            Nova receita
          </Link>
        )}
      </PageHeader>

      {recipes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma receita cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Rendimento</TableHead>
              <TableHead>Mão de obra / cento</TableHead>
              <TableHead>Margem</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.data.map((recipe) => (
              <TableRow key={recipe.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/recipes/${recipe.id}`} className="underline-offset-2 hover:underline">
                      {recipe.name}
                    </Link>
                  ) : (
                    recipe.name
                  )}
                </TableCell>
                {/* `batchYield` counts pieces per batch — the pricing divides it
                    by 100 to reach the hundred — so it reads in units. */}
                <TableCell className="tabular-nums">{formatWithUnit(recipe.batchYield, "UN")}</TableCell>
                <TableCell className="tabular-nums">{formatCurrency(recipe.laborCostPerHundred)}</TableCell>
                <TableCell className="tabular-nums">{formatQuantity(toPercent(recipe.margin))} %</TableCell>
                <TableCell className="space-x-2 text-right">
                  {canReadPricing && (
                    <Link
                      to={`/recipes/${recipe.id}/pricing`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Preço
                    </Link>
                  )}
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(recipe.id)}>
                      Excluir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={pendingId !== null}
        onOpenChange={(open) => !open && setPendingId(null)}
        title="Excluir receita"
        description="Só é possível excluir uma receita que nunca foi produzida. Não dá para desfazer."
        confirmLabel="Excluir receita"
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
```

- [ ] **Step 4: Wire the route**

Em `src/app/router.tsx`, acrescentar o import:

```tsx
import { RecipesListPage } from "@/features/recipes/RecipesListPage";
```

Acrescentar `"/recipes"` ao conjunto de rotas já construídas:

```tsx
const BUILT_ROUTES = new Set(["/supplies", "/recipes", "/stock", "/users", "/roles"]);
```

E acrescentar o bloco de rota, depois do bloco de `SUPPLIES_READ`:

```tsx
      {
        element: <RequirePermission permission="RECIPES_READ" />,
        errorElement: <RouteError />,
        children: [{ path: "/recipes", element: <RecipesListPage /> }],
      },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/recipes/RecipesListPage.test.tsx src/app/router.test.tsx`
Expected: PASS. O teste `%s resolves to a route` do `router.test.tsx` já cobria `/recipes` pelo placeholder e continua
verde agora contra a tela real.

- [ ] **Step 6: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/recipes/RecipesListPage.tsx src/features/recipes/RecipesListPage.test.tsx src/app/router.tsx
git commit -m "feat(recipes): list recipes with yield, labor cost and margin"
```

---

### Task 4: O formulário — cadastro

A tela composta: cabeçalho e itens numa submissão só, porque `POST /recipes` exige ao menos um item no mesmo corpo.

Esta tarefa entrega o modo de criação. As duas regras de item — unidade restrita à dimensão e insumo repetido — ficam
para a Task 5, e a edição para a Task 6.

**Files:**

- Create: `src/features/recipes/RecipeFormPage.tsx`
- Modify: `src/app/router.tsx` (rota `/recipes/new`)
- Test: `src/features/recipes/RecipeFormPage.test.tsx`
- Test: `src/app/router.test.tsx` (`/recipes/new` no `test.each` do portão de escrita)

**Interfaces:**

- Consumes: `useSupplies` de `@/features/supplies/use-supplies`, `useCreateRecipe` (Task 2), `fromPercent` (Task 1),
  `unitLabel` e `unitsOfDimension` de `@/lib/unit`, `isFormError` de `@/lib/form-errors`
- Produces: `RecipeFormPage`, e a rota `/recipes/new` sob `RequirePermission permission="RECIPES_WRITE"`

- [ ] **Step 1: Write the failing test**

Criar `src/features/recipes/RecipeFormPage.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/RecipeFormPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/recipes/RecipeFormPage"`.

- [ ] **Step 3: Write the screen**

Criar `src/features/recipes/RecipeFormPage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentProps, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fromPercent } from "@/features/recipes/margin";
import type { CreateRecipeInput } from "@/features/recipes/recipes.api";
import { useCreateRecipe } from "@/features/recipes/use-recipe-mutations";
import { useSupplies } from "@/features/supplies/use-supplies";
import { isFormError } from "@/lib/form-errors";
import { ApiError } from "@/lib/http";
import { ALL_UNITS, unitLabel } from "@/lib/unit";

/**
 * Mirrors the API's Zod so the error shows before the round trip. The
 * `preprocess` on the two money-ish fields is the trap `z.coerce.number()` sets
 * on its own: `Number("")` is `0`, so an untouched field would silently coerce
 * to free labor and a zero margin instead of failing as unanswered. A typed `0`
 * still passes `nonnegative` untouched — both are legitimate values.
 *
 * The margin is a percentage here and a fraction on the wire; `fromPercent` is
 * the only place that crosses.
 */
const recipeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  batchYield: z.coerce.number().positive("Informe um rendimento maior que zero"),
  laborCostPerHundred: z.preprocess(
    (value) => (value === "" ? NaN : value),
    z.coerce.number({ error: "Informe a mão de obra" }).nonnegative("A mão de obra não pode ser negativa"),
  ),
  marginPercent: z.preprocess(
    (value) => (value === "" ? NaN : value),
    z.coerce.number({ error: "Informe a margem" }).nonnegative("A margem não pode ser negativa"),
  ),
  items: z
    .array(
      z.object({
        supplyId: z.string().uuid("Escolha o insumo"),
        usageQty: z.coerce.number().positive("Informe a quantidade"),
        // The literal tuple, not `ALL_UNITS`: `z.enum` needs a readonly tuple,
        // and `ALL_UNITS` is a `Unit[]`. `SupplyFormPage` spells it out the
        // same way, and `unit.ts` keeps tsc honest if the API adds a unit.
        usageUnit: z.enum(["G", "KG", "ML", "L", "UN"]),
      }),
    )
    .min(1, "Adicione ao menos um insumo"),
});

type RecipeFormInput = z.input<typeof recipeSchema>;
type RecipeFormValues = z.output<typeof recipeSchema>;

function toPayload(values: RecipeFormValues): CreateRecipeInput {
  return {
    name: values.name,
    batchYield: values.batchYield,
    laborCostPerHundred: values.laborCostPerHundred,
    margin: fromPercent(values.marginPercent),
    items: values.items.map((item) => ({
      supplyId: item.supplyId,
      usageQty: item.usageQty,
      usageUnit: item.usageUnit,
    })),
  };
}

interface FieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

function Field({ id, label, error, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível salvar. Verifique sua conexão.";
}

export function RecipeFormPage() {
  const navigate = useNavigate();
  const supplies = useSupplies();
  const createRecipe = useCreateRecipe();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormInput, unknown, RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { items: [] },
  });

  const items = useFieldArray({ control, name: "items" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await createRecipe.mutateAsync(toPayload(values));
      navigate("/recipes", { replace: true });
    } catch (error) {
      if (isFormError(error)) setFormError((error as ApiError).message);
      else toast.error(toastMessageFor(error));
    }
  });

  if (supplies.isError) {
    return (
      <section className="p-8">
        <QueryErrorState error={supplies.error} onRetry={() => void supplies.refetch()} />
        <Link to="/recipes" className="mt-4 inline-block text-sm underline">
          Voltar para receitas
        </Link>
      </section>
    );
  }
  if (!supplies.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  // The API needs at least one item, and the select would have nothing in it.
  if (supplies.data.length === 0) {
    return (
      <section className="p-8">
        <PageHeader title="Nova receita" />
        <p className="text-sm text-muted-foreground">Cadastre um insumo antes de criar uma receita.</p>
        <Link to="/supplies/new" className={buttonVariants({ size: "sm", className: "mt-4" })}>
          Cadastrar insumo
        </Link>
      </section>
    );
  }

  return (
    <section className="p-8">
      <PageHeader title="Nova receita" />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />
          <Field
            id="batchYield"
            label="Rendimento do lote (un)"
            type="number"
            step="any"
            error={errors.batchYield?.message}
            {...register("batchYield")}
          />
          <Field
            id="laborCostPerHundred"
            label="Mão de obra por cento"
            type="number"
            step="any"
            error={errors.laborCostPerHundred?.message}
            {...register("laborCostPerHundred")}
          />
          <Field
            id="marginPercent"
            label="Margem (%)"
            type="number"
            step="any"
            error={errors.marginPercent?.message}
            {...register("marginPercent")}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Insumos da receita</legend>

          {items.fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              {/* The three row controls are named by `aria-label`, not by a
                  visible `<Label>`: the column headers of a row do not repeat
                  per row, and a screen reader still needs "item 3" said out
                  loud. */}
              <div className="flex-1 space-y-1.5">
                <NativeSelect aria-label={`Insumo do item ${index + 1}`} {...register(`items.${index}.supplyId`)}>
                  <option value="">Escolha o insumo</option>
                  {supplies.data.map((supply) => (
                    <option key={supply.id} value={supply.id}>
                      {supply.name}
                    </option>
                  ))}
                </NativeSelect>
                {errors.items?.[index]?.supplyId && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.items[index]!.supplyId!.message}
                  </p>
                )}
              </div>

              <div className="w-32 space-y-1.5">
                <Input
                  type="number"
                  step="any"
                  aria-label={`Quantidade do item ${index + 1}`}
                  {...register(`items.${index}.usageQty`)}
                />
                {errors.items?.[index]?.usageQty && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.items[index]!.usageQty!.message}
                  </p>
                )}
              </div>

              <div className="w-24">
                <NativeSelect aria-label={`Unidade do item ${index + 1}`} {...register(`items.${index}.usageUnit`)}>
                  {ALL_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unitLabel(unit)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remover item ${index + 1}`}
                onClick={() => items.remove(index)}
              >
                Remover
              </Button>
            </div>
          ))}

          {/* Removing the last row is not blocked by the button: the schema
              refuses the submission, and the message explains itself. The
              `min(1)` error belongs to the array itself, which react-hook-form
              exposes on `.message` or under `.root` depending on how it was
              set — read both. */}
          {(errors.items?.message ?? errors.items?.root?.message) && (
            <p role="alert" className="text-sm text-destructive">
              {errors.items?.message ?? errors.items?.root?.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => items.append({ supplyId: "", usageQty: "", usageUnit: supplies.data![0].purchaseUnit })}
          >
            Adicionar insumo
          </Button>
        </fieldset>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Salvar
          </Button>
          <Link to="/recipes" className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Wire the route**

Em `src/app/router.tsx`, acrescentar o import:

```tsx
import { RecipeFormPage } from "@/features/recipes/RecipeFormPage";
```

E o bloco de escrita, depois do bloco de `SUPPLIES_WRITE`:

```tsx
      {
        element: <RequirePermission permission="RECIPES_WRITE" />,
        errorElement: <RouteError />,
        children: [
          // Static before dynamic: `/recipes/new` must not be read as an id.
          { path: "/recipes/new", element: <RecipeFormPage /> },
        ],
      },
```

- [ ] **Step 5: Extend the router test**

Em `src/app/router.test.tsx`, acrescentar `/recipes/new` ao `test.each` do portão de escrita e um handler para a rota
que a lista de receitas chama:

```tsx
  test.each(["/users/new", "/roles/new", "/supplies/new", "/recipes/new"])(
```

No `server.use` desse teste, acrescentar:

```tsx
        msw.get(`${API}/recipes`, () => HttpResponse.json([])),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/recipes/RecipeFormPage.test.tsx src/app/router.test.tsx`
Expected: PASS — 5 testes novos no formulário, e o portão de escrita cobrindo `/recipes/new`.

- [ ] **Step 7: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/recipes/RecipeFormPage.tsx src/features/recipes/RecipeFormPage.test.tsx src/app/router.tsx src/app/router.test.tsx
git commit -m "feat(recipes): create a recipe with its items in one submission"
```

---

### Task 5: As duas regras de item

A unidade da linha restrita à dimensão do insumo, e o insumo repetido recusado.

A primeira torna o `400` de `DIMENSION_MISMATCH` inalcançável pela tela: a API recusa item cuja unidade seja de outra
dimensão que a `purchaseUnit` do insumo, e um select ingênuo oferece caminhos que só falham depois do envio.

A segunda cobre um buraco da API: `RecipeItem` não tem `@@unique(recipeId, supplyId)` e a rota não checa, então a mesma
farinha entra duas vezes e o custo soma as duas linhas sem avisar.

**Files:**

- Modify: `src/features/recipes/RecipeFormPage.tsx`
- Test: `src/features/recipes/RecipeFormPage.test.tsx` (um `describe` novo)

**Interfaces:**

- Consumes: `unitsOfDimension` de `@/lib/unit`, `useWatch` de `react-hook-form`
- Produces: nada novo para fora — o comportamento fica dentro de `RecipeFormPage`

- [ ] **Step 1: Write the failing test**

Acrescentar a `src/features/recipes/RecipeFormPage.test.tsx`, depois do `describe` existente:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/RecipeFormPage.test.tsx -t "the item rules"`
Expected: FAIL — o select de unidade oferece as cinco unidades (`["G","KG","ML","L","UN"]`), trocar o insumo não muda a
unidade, e a duplicata é enviada à API.

- [ ] **Step 3: Add the duplicate rule to the schema**

Em `src/features/recipes/RecipeFormPage.tsx`, encadear um `superRefine` no schema, logo depois do `z.object({...})`:

```ts
}).superRefine((values, ctx) => {
  // `RecipeItem` has no `@@unique(recipeId, supplyId)` in the API's schema and
  // the route does not check: the same supply enters twice and the pricing sums
  // both rows without a word. The issue lands on the second row, which is the
  // one to fix.
  const seen = new Set<string>();
  values.items.forEach((item, index) => {
    if (seen.has(item.supplyId)) {
      ctx.addIssue({
        code: "custom",
        message: "Este insumo já está na receita",
        path: ["items", index, "supplyId"],
      });
    }
    seen.add(item.supplyId);
  });
});
```

- [ ] **Step 4: Restrict the row's unit to the supply's dimension**

Ainda em `RecipeFormPage.tsx`, acrescentar aos imports:

```tsx
import { type ChangeEvent, type ComponentProps, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ALL_UNITS, unitLabel, unitsOfDimension } from "@/lib/unit";
```

Acrescentar `setValue` ao que vem do `useForm`, e observar as linhas:

```tsx
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormInput, unknown, RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { items: [] },
  });

  const items = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
```

Depois do early return que garante `supplies.data` não vazio, indexar os insumos por id:

```tsx
  const suppliesById = new Map(supplies.data.map((supply) => [supply.id, supply]));
```

Trocar o `<NativeSelect>` do insumo para interceptar a troca. O `register` devolve o próprio `onChange`, que precisa
continuar rodando — o handler chama os dois:

```tsx
                <NativeSelect
                  aria-label={`Insumo do item ${index + 1}`}
                  {...register(`items.${index}.supplyId`, {
                    onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                      const supply = suppliesById.get(event.target.value);
                      if (!supply) return;
                      const current = watchedItems?.[index]?.usageUnit;
                      // Only when the dimension changed: re-picking a supply in
                      // the same dimension must not undo a deliberate "g".
                      if (!current || !unitsOfDimension(supply.purchaseUnit).includes(current)) {
                        setValue(`items.${index}.usageUnit`, supply.purchaseUnit);
                      }
                    },
                  })}
                >
```

E trocar o `<NativeSelect>` da unidade para oferecer só a dimensão do insumo escolhido. Sem insumo escolhido ainda, as
cinco — não há dimensão a respeitar:

```tsx
              <div className="w-24">
                <NativeSelect aria-label={`Unidade do item ${index + 1}`} {...register(`items.${index}.usageUnit`)}>
                  {(() => {
                    const supply = suppliesById.get(watchedItems?.[index]?.supplyId ?? "");
                    return supply ? unitsOfDimension(supply.purchaseUnit) : ALL_UNITS;
                  })().map((unit) => (
                    <option key={unit} value={unit}>
                      {unitLabel(unit)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/recipes/RecipeFormPage.test.tsx`
Expected: PASS — os 5 testes da Task 4 mais os 3 novos.

- [ ] **Step 6: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/recipes/RecipeFormPage.tsx src/features/recipes/RecipeFormPage.test.tsx
git commit -m "feat(recipes): restrict item units by dimension and refuse a repeated supply"
```

---

### Task 6: O formulário — edição

O mesmo componente serve criar e editar, como `SupplyFormPage` e `UserFormPage`. A diferença que importa: `PATCH
/recipes/:id` interpreta `items` como **substituição do conjunto inteiro**, então a submissão manda tudo, não só o que
mudou.

**Files:**

- Modify: `src/features/recipes/RecipeFormPage.tsx`
- Modify: `src/app/router.tsx` (rota `/recipes/:id`)
- Test: `src/features/recipes/RecipeFormPage.test.tsx` (um `describe` novo)

**Interfaces:**

- Consumes: `useRecipe` (Task 2), `useUpdateRecipe` (Task 2), `toPercent` (Task 1), `useParams` de `react-router-dom`
- Produces: a rota `/recipes/:id` sob `RequirePermission permission="RECIPES_WRITE"`

- [ ] **Step 1: Write the failing test**

Acrescentar a `src/features/recipes/RecipeFormPage.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/RecipeFormPage.test.tsx -t "editing"`
Expected: FAIL — o formulário abre vazio; nenhum `GET /recipes/:id` é feito.

- [ ] **Step 3: Add the edit mode**

Em `src/features/recipes/RecipeFormPage.tsx`, acrescentar aos imports:

```tsx
import { type ChangeEvent, type ComponentProps, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fromPercent, toPercent } from "@/features/recipes/margin";
import { useRecipe } from "@/features/recipes/use-recipe";
import { useCreateRecipe, useUpdateRecipe } from "@/features/recipes/use-recipe-mutations";
```

No corpo do componente, antes do `useForm`:

```tsx
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const recipe = useRecipe(id);
  const updateRecipe = useUpdateRecipe(id ?? "");
```

Acrescentar `reset` ao que vem do `useForm`, e semear o formulário quando a API responder. `reset`, não `setValue`, para
os campos não nascerem sujos:

```tsx
  useEffect(() => {
    if (!isEditing || !recipe.data) return;
    reset({
      name: recipe.data.name,
      batchYield: recipe.data.batchYield,
      laborCostPerHundred: recipe.data.laborCostPerHundred,
      marginPercent: toPercent(recipe.data.margin),
      items: recipe.data.items.map((item) => ({
        supplyId: item.supplyId,
        usageQty: item.usageQty,
        usageUnit: item.usageUnit,
      })),
    });
  }, [isEditing, recipe.data, reset]);
```

Trocar o corpo do `onSubmit` para escolher a mutação:

```tsx
      if (isEditing) await updateRecipe.mutateAsync(toPayload(values));
      else await createRecipe.mutateAsync(toPayload(values));
      navigate("/recipes", { replace: true });
```

Tratar o erro de leitura da receita junto com o dos insumos, e esperar as duas cargas:

```tsx
  if (recipe.isError) {
    return (
      <section className="p-8">
        <QueryErrorState error={recipe.error} onRetry={() => void recipe.refetch()} />
        <Link to="/recipes" className="mt-4 inline-block text-sm underline">
          Voltar para receitas
        </Link>
      </section>
    );
  }
  if (isEditing && !recipe.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;
```

E o título passa a distinguir os dois modos:

```tsx
      <PageHeader title={isEditing ? recipe.data!.name : "Nova receita"} />
```

O convite a cadastrar insumo continua valendo só na criação — editar uma receita existente já implica insumos
cadastrados. Guardar a condição:

```tsx
  if (!isEditing && supplies.data.length === 0) {
```

- [ ] **Step 4: Wire the route**

Em `src/app/router.tsx`, acrescentar ao bloco de `RECIPES_WRITE`, depois de `/recipes/new`:

```tsx
          { path: "/recipes/:id", element: <RecipeFormPage /> },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/recipes/RecipeFormPage.test.tsx`
Expected: PASS — 10 testes.

- [ ] **Step 6: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/recipes/RecipeFormPage.tsx src/features/recipes/RecipeFormPage.test.tsx src/app/router.tsx
git commit -m "feat(recipes): edit a recipe replacing its whole set of items"
```

---

### Task 7: A tela de preço

A tela que responde a pergunta da fatia. Duas queries: a receita, para o nome e a margem, e o preço, para os números —
a resposta de pricing não traz nem nome nem margem, e um preço sem a margem que o gerou esconde metade da informação.

O guard é duplo e aninhado. `PRICING_READ` é independente de `RECIPES_READ` no enum da API, e a tela lê as duas rotas.

**Files:**

- Create: `src/features/recipes/RecipePricingPage.tsx`
- Modify: `src/app/router.tsx` (rota aninhada `/recipes/:id/pricing`)
- Test: `src/features/recipes/RecipePricingPage.test.tsx`
- Test: `src/app/router.test.tsx` (os dois portões da rota de preço)

**Interfaces:**

- Consumes: `useRecipe` (Task 2), `useRecipePricing` (Task 2), `toPercent` (Task 1), `formatCurrency` e
  `formatQuantity` de `@/lib/format`
- Produces: `RecipePricingPage`, e a rota `/recipes/:id/pricing` sob `RECIPES_READ` + `PRICING_READ`

- [ ] **Step 1: Write the failing test**

Criar `src/features/recipes/RecipePricingPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { RecipePricingPage } from "@/features/recipes/RecipePricingPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const RECIPE_ID = "44444444-4444-4444-8444-444444444444";

const recipe = {
  id: RECIPE_ID,
  name: "Coxinha",
  batchYield: 100,
  laborCostPerHundred: 12,
  margin: 0.35,
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
  items: [],
};

const pricing = {
  suppliesCostPerHundred: 38.4,
  totalCostPerHundred: 50.4,
  exactPrice: 68.04,
  pricePerHundred: 69,
  pricePerHalfHundred: 35,
};

function renderPricing() {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["RECIPES_READ", "RECIPES_WRITE", "PRICING_READ"],
      }),
    ),
    msw.get(`${API}/recipes/${RECIPE_ID}`, () => HttpResponse.json(recipe)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/recipes/:id/pricing" element={<RecipePricingPage />} />
      <Route path="/recipes/:id" element={<p>editar receita</p>} />
      <Route path="/recipes" element={<p>lista de receitas</p>} />
    </Routes>,
    { route: `/recipes/${RECIPE_ID}/pricing` },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RecipePricingPage", () => {
  test("shows the cost breakdown, the hundred and the half hundred", async () => {
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () => HttpResponse.json(pricing)));
    renderPricing();

    expect(await screen.findByText("R$ 38,40")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,40")).toBeInTheDocument();
    expect(screen.getByText("R$ 68,04")).toBeInTheDocument();
    expect(screen.getByText("R$ 69,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 35,00")).toBeInTheDocument();
  });

  // Labor and margin come from the recipe, not from the pricing response.
  test("shows the labor cost and the margin taken from the recipe", async () => {
    server.use(msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () => HttpResponse.json(pricing)));
    renderPricing();

    expect(await screen.findByText("R$ 12,00")).toBeInTheDocument();
    expect(screen.getByText("35 %")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coxinha" })).toBeInTheDocument();
  });

  // The form makes this impossible to create, not impossible to happen: editing
  // the supply afterwards, from KG to L, rots a recipe that was saved valid.
  test("a 409 explains the dimension drift and links to the edit screen", async () => {
    server.use(
      msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () =>
        HttpResponse.json({ code: "DIMENSION_MISMATCH", message: "Dimensões incompatíveis" }, { status: 409 }),
      ),
    );
    renderPricing();

    expect(await screen.findByText(/unidade de outra dimensão/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /editar a receita/i })).toHaveAttribute(
      "href",
      `/recipes/${RECIPE_ID}`,
    );
  });

  test("a 404 says the recipe was not found and links back to the list", async () => {
    server.use(
      msw.get(`${API}/recipes/${RECIPE_ID}`, () =>
        HttpResponse.json({ message: "Receita não encontrada" }, { status: 404 }),
      ),
      msw.get(`${API}/recipes/${RECIPE_ID}/pricing`, () =>
        HttpResponse.json({ message: "Receita não encontrada" }, { status: 404 }),
      ),
    );
    renderPricing();

    expect(await screen.findByText(/receita não encontrada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para receitas/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/recipes/RecipePricingPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/recipes/RecipePricingPage"`.

- [ ] **Step 3: Write the screen**

Criar `src/features/recipes/RecipePricingPage.tsx`:

```tsx
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { toPercent } from "@/features/recipes/margin";
import { useRecipe } from "@/features/recipes/use-recipe";
import { useRecipePricing } from "@/features/recipes/use-recipe-pricing";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { ApiError } from "@/lib/http";

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between border-b py-2 ${strong ? "text-lg font-semibold" : ""}`}>
      <span className={strong ? "" : "text-sm text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function RecipePricingPage() {
  const { id } = useParams<{ id: string }>();
  const recipe = useRecipe(id);
  const pricing = useRecipePricing(id);

  const notFound =
    (recipe.error instanceof ApiError && recipe.error.status === 404) ||
    (pricing.error instanceof ApiError && pricing.error.status === 404);

  if (notFound) {
    return (
      <section className="p-8">
        <p role="alert" className="text-sm">
          Receita não encontrada.
        </p>
        <Link to="/recipes" className="mt-4 inline-block text-sm underline">
          Voltar para receitas
        </Link>
      </section>
    );
  }

  /**
   * The 409 the pricing route answers with is `DIMENSION_MISMATCH`, and the form
   * makes it impossible to create — but not impossible to happen. Editing a
   * supply afterwards, from KG to L, rots a recipe that was saved valid. The
   * fix is one screen away, and the link is the whole point of the message.
   */
  if (pricing.error instanceof ApiError && pricing.error.status === 409) {
    return (
      <section className="p-8">
        <p role="alert" className="text-sm">
          Um insumo desta receita mudou para uma unidade de outra dimensão.{" "}
          <Link to={`/recipes/${id}`} className="underline">
            Editar a receita
          </Link>{" "}
          para calcular o preço.
        </p>
      </section>
    );
  }

  if (recipe.isError) return <QueryErrorState error={recipe.error} onRetry={() => void recipe.refetch()} />;
  if (pricing.isError) return <QueryErrorState error={pricing.error} onRetry={() => void pricing.refetch()} />;
  if (!recipe.data || !pricing.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title={recipe.data.name}>
        <Link to="/recipes" className="text-sm underline">
          Voltar para receitas
        </Link>
      </PageHeader>

      <div className="max-w-md">
        <Row label="Insumos / cento" value={formatCurrency(pricing.data.suppliesCostPerHundred)} />
        {/* Labor comes from the recipe: subtracting the two costs would reach
            the same number by inventing a calculation the API already did. */}
        <Row label="Mão de obra / cento" value={formatCurrency(recipe.data.laborCostPerHundred)} />
        <Row label="Custo total / cento" value={formatCurrency(pricing.data.totalCostPerHundred)} />
        <Row label="Margem" value={`${formatQuantity(toPercent(recipe.data.margin))} %`} />
        {/* The exact price sits next to the hundred on purpose: it is where the
            round up to the whole real becomes visible. */}
        <Row label="Preço exato" value={formatCurrency(pricing.data.exactPrice)} />
        <Row label="Cento" value={formatCurrency(pricing.data.pricePerHundred)} strong />
        <Row label="Meio cento" value={formatCurrency(pricing.data.pricePerHalfHundred)} strong />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire the nested route**

Em `src/app/router.tsx`, acrescentar o import:

```tsx
import { RecipePricingPage } from "@/features/recipes/RecipePricingPage";
```

E aninhar a rota de preço dentro do bloco de `RECIPES_READ` criado na Task 3:

```tsx
      {
        element: <RequirePermission permission="RECIPES_READ" />,
        errorElement: <RouteError />,
        children: [
          { path: "/recipes", element: <RecipesListPage /> },
          // Two guards, nested: the screen reads both routes. The outer is
          // RECIPES_READ — whoever may not see any recipe should not learn that
          // this one exists — and the inner is PRICING_READ.
          {
            element: <RequirePermission permission="PRICING_READ" />,
            children: [{ path: "/recipes/:id/pricing", element: <RecipePricingPage /> }],
          },
        ],
      },
```

- [ ] **Step 5: Test both gates in the router test**

Acrescentar a `src/app/router.test.tsx`, dentro do `describe("router")`:

```tsx
  // PRICING_READ and RECIPES_READ are independent in the API's enum, and the
  // pricing screen reads a route behind each one.
  test.each([
    ["without RECIPES_READ", ["PRICING_READ"]],
    ["without PRICING_READ", ["RECIPES_READ"]],
  ])("the pricing screen is forbidden %s", async (_label, permissions) => {
    server.use(
      msw.get(`${API}/me`, () =>
        HttpResponse.json({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Leitora",
          username: "leitora",
          email: "leitora@example.com",
          permissions,
        }),
      ),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    const router = createMemoryRouter(routes, {
      initialEntries: ["/recipes/44444444-4444-4444-8444-444444444444/pricing"],
    });
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: /acesso negado/i })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/recipes/RecipePricingPage.test.tsx src/app/router.test.tsx`
Expected: PASS — 4 testes da tela e os 2 portões.

- [ ] **Step 7: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/recipes/RecipePricingPage.tsx src/features/recipes/RecipePricingPage.test.tsx src/app/router.tsx src/app/router.test.tsx
git commit -m "feat(recipes): price a recipe by the hundred and the half hundred"
```

---

### Task 8: O preço muda quando o insumo muda

Um vazamento que a hierarquia de chave não cobre. Editar o preço de compra de um insumo muda o preço de toda receita que
o use, e invalidar `["supplies"]` não alcança `["recipes"]`. Não há como saber quais receitas usam o insumo sem pedir o
detalhe de todas.

A escolha é invalidar `["recipes"]` junto: grosso, barato, e do mesmo espírito de "errar barato é melhor que acertar
frágil" que as fatias anteriores adotaram.

Esta é a única mudança fora de `features/recipes` e do router.

**Files:**

- Modify: `src/features/supplies/use-supply-mutations.ts`
- Test: `src/features/supplies/use-supply-mutations.test.ts` (novo arquivo)

**Interfaces:**

- Consumes: `RECIPES_QUERY_KEY` (Task 2)
- Produces: `useInvalidateSupplies` passa a invalidar `["supplies"]` **e** `["recipes"]`

- [ ] **Step 1: Write the failing test**

Criar `src/features/supplies/use-supply-mutations.test.ts`:

```ts
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { useInvalidateSupplies } from "@/features/supplies/use-supply-mutations";
import { createQueryClient } from "@/lib/query";

describe("useInvalidateSupplies", () => {
  // Editing a supply's purchase price changes the price of every recipe that
  // uses it, and `["supplies"]` is not a prefix of `["recipes"]`. There is no
  // way to know which recipes use the supply without fetching all of them, so
  // the invalidation is deliberately coarse.
  test("invalidates the recipes too, because a supply's price changes theirs", () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useInvalidateSupplies(), { wrapper });
    result.current();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["supplies"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["recipes"] });
  });
});
```

O arquivo tem JSX no `wrapper`, então precisa da extensão `.tsx`: salvar como
`src/features/supplies/use-supply-mutations.test.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/supplies/use-supply-mutations.test.tsx`
Expected: FAIL — `expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["recipes"] })`, chamado só com
`["supplies"]`.

- [ ] **Step 3: Write the implementation**

Em `src/features/supplies/use-supply-mutations.ts`, acrescentar o import e a segunda invalidação:

```ts
import { RECIPES_QUERY_KEY } from "@/features/recipes/use-recipes";
```

E trocar o corpo de `useInvalidateSupplies`:

```ts
/**
 * Coarse by key hierarchy: `["supplies"]` is a prefix of `["supplies", id]` and
 * of the ledger key, so one call reaches the list, the detail and the movements
 * of every supply. Nothing here touches `["me"]` — no screen in this slice
 * changes the permissions of whoever is logged in.
 *
 * `["recipes"]` is not under that prefix and is invalidated on purpose: editing
 * a supply's purchase price changes the price of every recipe that uses it, and
 * there is no way to know which ones without fetching all of them.
 */
export function useInvalidateSupplies() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: SUPPLIES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/supplies/use-supply-mutations.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck, format and run the whole suite**

Run: `npx tsc -b && npm run lint:prettier:fix && npm run test`
Expected: PASS. Atenção a testes de insumo que passaram a fazer uma requisição a mais: se algum falhar por
`onUnhandledRequest: "error"` sem handler de `GET /recipes`, o handler entra no teste que falhou — a invalidação só
refaz uma query que já esteja montada, então na prática só um teste que renderize as duas telas seria afetado.

- [ ] **Step 6: Commit**

```bash
git add src/features/supplies/use-supply-mutations.ts src/features/supplies/use-supply-mutations.test.tsx
git commit -m "fix(supplies): invalidate recipes when a supply changes"
```

---

## Fechamento da fatia

Depois da Task 8, rodar o portão completo e conferir a saída antes de dizer que acabou:

```bash
npx tsc -b && npm run lint:prettier:check && npm run test
```

Os dois achados do `wa-api` que a spec registra viram issue no outro repositório, **sem tocar em código de lá**:

1. `RECIPES_WRITE` sem `SUPPLIES_READ` abre o formulário e toma 403 na query de insumos — terceira tela seguida com o
   mesmo defeito de permissão cruzada.
2. `RecipeItem` não tem `@@unique(recipeId, supplyId)`; esta fatia recusa no cliente, mas a invariante é do banco.
