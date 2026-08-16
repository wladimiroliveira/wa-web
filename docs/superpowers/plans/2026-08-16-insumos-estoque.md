# Insumos e Estoque — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o cadastro de insumos e a operação de estoque — saldos, entrada e razão de movimentações.

**Architecture:** Cinco telas em rota própria sobre a fundação da fatia 1, divididas em dois módulos: `features/supplies`
é o cadastro, `features/stock` é a operação, e o segundo lê a query do primeiro em vez de abrir uma sua. O núcleo é um
módulo de unidade que traduz a base do back end — grama, mililitro, unidade — para a unidade em que a pessoa compra.
A conversão é só de leitura: nenhuma tela multiplica antes de enviar.

**Tech Stack:** React 19, TypeScript, React Router v7, TanStack Query v5, react-hook-form + Zod, Tailwind v4,
shadcn/ui (primitivas `@base-ui/react`), Vitest, Testing Library, MSW.

**Spec:** [docs/superpowers/specs/2026-08-16-insumos-estoque-design.md](../specs/2026-08-16-insumos-estoque-design.md)

## Global Constraints

- **Idioma:** identificadores, arquivos, testes e comentários em inglês. Português só no texto que a pessoa lê na tela.
- **Segmento de URL é identificador:** `/supplies/new`, nunca `/insumos/novo`.
- **TDD sem exceção:** teste vermelho primeiro, com a saída da falha colada, antes de qualquer implementação.
- **Commits:** o usuário autorizou, em 2026-08-16, um commit por tarefa no branch `feat/supplies-stock` e só nele. Nada
  de push, nada de PR, nada na `main`. Cada tarefa termina com a suíte rodada, a saída colada e o commit feito com a
  mensagem escrita no passo final.
- **Prettier:** 120 colunas, aspas duplas, ponto e vírgula, `trailingComma: all`. Rodar `npm run lint:prettier:fix` antes
  de fechar cada tarefa. `docs/` e `src/lib/api.types.ts` estão no `.prettierignore`.
- **MSW roda com `onUnhandledRequest: "error"`:** todo endpoint que a tela chama precisa de handler no teste, inclusive
  `GET /me`. Uma requisição não prevista falha o teste.
- **Nenhuma trava de segurança no front end.** Se a API permite, a tela permite. Achado de back end vira issue no
  `wa-api`, não trava aqui.
- **API base nos testes:** `http://localhost:3333`, o valor de `VITE_API_URL` em `.env.test`.
- **Tipos vêm de `@/lib/api.types`**, sempre derivados de `paths`. Nenhum contrato redigitado à mão.
- **A conversão de unidade é só de leitura.** Nenhuma tela converte para a base antes de enviar: a API recebe
  `quantity` + `unit` crus e converte com `Decimal`.

---

### Task 1: Regenerar os tipos da API

O `src/lib/api.types.ts` versionado descreve `GET /supplies/:id/movements` devolvendo um array. A API paginou o razão
por cursor no commit `ad80267` e a rota passou a devolver `{ data, nextCursor }`. Sem esta tarefa, a Task 6 tipa a
paginação contra um contrato que não existe mais.

Esta tarefa não tem teste próprio: ela troca um arquivo gerado. A verificação é o `tsc` e a suíte inteira, que já cobrem
os módulos que consomem esses tipos.

**Files:**

- Modify: `package.json` (script `api:types`)
- Modify: `src/lib/api.types.ts` (gerado, não editar à mão)

**Interfaces:**

- Consumes: nada
- Produces: `paths["/supplies/{id}/movements"]["get"]["responses"][200]["content"]["application/json"]` com o formato
  `{ data: Movement[]; nextCursor: string | null }`, e o parâmetro de query `cursor?: string` na mesma rota

- [ ] **Step 1: Confirmar que a fonte existe**

Run: `ls -l ../wa-api/openapi.json`
Expected: o arquivo existe. Se não existir, PARE e avise — o repositório `wa-api` precisa estar ao lado deste.

- [ ] **Step 2: Registrar o contrato de antes**

Run: `grep -c "nextCursor" src/lib/api.types.ts`
Expected: `0`. É a prova de que os tipos estão defasados, e o contraste com o Step 5.

- [ ] **Step 3: Apontar o script para o contrato versionado**

Em `package.json`, trocar a linha do script:

```json
"api:types": "openapi-typescript ../wa-api/openapi.json -o src/lib/api.types.ts",
```

- [ ] **Step 4: Regenerar**

Run: `npm run api:types`
Expected: termina sem erro e reescreve `src/lib/api.types.ts`.

- [ ] **Step 5: Verificar que o razão virou página**

Run: `grep -c "nextCursor" src/lib/api.types.ts`
Expected: um número maior que zero.

Run: `grep -n '"/me/password"\|"/users/{id}/password"' src/lib/api.types.ts`
Expected: as duas rotas aparecem. Elas não são desta fatia — a confirmação serve só para provar que o arquivo veio do
contrato novo.

- [ ] **Step 6: Verificar que nada quebrou na tipagem**

Run: `npx tsc -b`
Expected: sem saída, código 0.

Se quebrar em `src/features/users` ou `src/features/roles`, o conserto entra nesta tarefa: tipo que mente é dívida, não
escopo novo. Não silencie com `any` nem com `@ts-expect-error` — ajuste o consumo ao contrato novo.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: 26 arquivos, 156 testes, todos passando.

- [ ] **Step 8: Commit**

```bash
npm run lint:prettier:fix
git add package.json src/lib/api.types.ts
git commit -m "chore(api): regenerate the types from the versioned contract"
```

---

### Task 2: O módulo de unidade

Espelha o `UNIT_METADATA` do `wa-api` e converte a base para a unidade de compra. É lógica pura, sem React, e é onde
mora o risco de mostrar um saldo errado — por isso vem antes de qualquer tela.

**Files:**

- Create: `src/lib/unit.ts`
- Test: `src/lib/unit.test.ts`

**Interfaces:**

- Consumes: `paths` de `@/lib/api.types`, `formatQuantity` de `@/lib/format`
- Produces:
  ```ts
  type Unit = "G" | "KG" | "ML" | "L" | "UN";
  type Dimension = "WEIGHT" | "VOLUME" | "COUNT";
  const UNIT_METADATA: Record<Unit, { dimension: Dimension; factorToBase: number; label: string }>;
  const ALL_UNITS: Unit[];
  function fromBase(base: number, unit: Unit): number;
  function unitsOfDimension(unit: Unit): Unit[];
  function unitLabel(unit: Unit): string;
  function formatWithUnit(value: number, unit: Unit): string; // NÃO converte
  function formatInUnit(base: number, unit: Unit): string; // converte da base
  ```

- [ ] **Step 1: Write the failing test**

`src/lib/unit.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  ALL_UNITS,
  formatInUnit,
  formatWithUnit,
  fromBase,
  UNIT_METADATA,
  unitLabel,
  unitsOfDimension,
} from "@/lib/unit";

describe("fromBase", () => {
  test("divides by the factor of the target unit", () => {
    expect(fromBase(12500, "KG")).toBe(12.5);
    expect(fromBase(750, "L")).toBe(0.75);
  });

  test("returns the base untouched for the units whose factor is 1", () => {
    expect(fromBase(300, "G")).toBe(300);
    expect(fromBase(750, "ML")).toBe(750);
    expect(fromBase(40, "UN")).toBe(40);
  });

  // A production may consume more than there is: the API records it and warns
  // instead of refusing, so a negative balance is a state the screen must show.
  test("keeps the sign of a negative balance", () => {
    expect(fromBase(-1200, "KG")).toBe(-1.2);
  });
});

describe("unitsOfDimension", () => {
  test("offers only the units of the same dimension, including the one asked for", () => {
    expect(unitsOfDimension("KG")).toEqual(["G", "KG"]);
    expect(unitsOfDimension("ML")).toEqual(["ML", "L"]);
    expect(unitsOfDimension("UN")).toEqual(["UN"]);
  });
});

describe("formatting", () => {
  test("formatWithUnit does not convert — the value is already in the unit", () => {
    expect(formatWithUnit(5, "KG")).toBe("5 kg");
  });

  test("formatInUnit converts from the base and labels the unit", () => {
    expect(formatInUnit(12500, "KG")).toBe("12,5 kg");
    expect(formatInUnit(40, "UN")).toBe("40 un");
  });

  test("caps at three decimals, as formatQuantity does", () => {
    expect(formatInUnit(1, "KG")).toBe("0,001 kg");
  });

  test("unitLabel is the lowercase abbreviation the screen shows", () => {
    expect(ALL_UNITS.map(unitLabel)).toEqual(["g", "kg", "ml", "l", "un"]);
  });
});

// The metadata mirrors a table in the wa-api. A unit added there must not reach
// the screen without a dimension and a factor, and `Record<Unit, …>` is what
// makes tsc refuse a partial one. This asserts the runtime half of that.
describe("the metadata mirrors the API", () => {
  test("every unit has a dimension and a factor, and ALL_UNITS is the record's keys", () => {
    expect(ALL_UNITS).toEqual(["G", "KG", "ML", "L", "UN"]);

    for (const unit of ALL_UNITS) {
      expect(UNIT_METADATA[unit].factorToBase).toBeGreaterThan(0);
      expect(["WEIGHT", "VOLUME", "COUNT"]).toContain(UNIT_METADATA[unit].dimension);
    }
  });

  test("each dimension has exactly one base unit, the one whose factor is 1", () => {
    const bases = ALL_UNITS.filter((unit) => UNIT_METADATA[unit].factorToBase === 1);

    expect(bases).toEqual(["G", "ML", "UN"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/unit.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/unit"`.

Cole a saída vermelha antes de seguir.

- [ ] **Step 3: Write minimal implementation**

`src/lib/unit.ts`:

```ts
import type { paths } from "@/lib/api.types";
import { formatQuantity } from "@/lib/format";

/**
 * Derived from the contract rather than retyped, so a unit added to the API
 * makes tsc fail on the `Record` below until someone gives it a factor.
 */
export type Unit = paths["/supplies"]["post"]["requestBody"]["content"]["application/json"]["purchaseUnit"];

export type Dimension = "WEIGHT" | "VOLUME" | "COUNT";

interface UnitMetadata {
  dimension: Dimension;
  /** What the API multiplies by to reach the base unit of the dimension. */
  factorToBase: number;
  /** What the screen prints after the number. */
  label: string;
}

/**
 * Mirrors `UNIT_METADATA` in the wa-api. It is deliberate duplication of five
 * lines: the alternative is showing the raw base, which reads as 12500 for a
 * balance of 12,5 kg.
 */
export const UNIT_METADATA: Record<Unit, UnitMetadata> = {
  G: { dimension: "WEIGHT", factorToBase: 1, label: "g" },
  KG: { dimension: "WEIGHT", factorToBase: 1000, label: "kg" },
  ML: { dimension: "VOLUME", factorToBase: 1, label: "ml" },
  L: { dimension: "VOLUME", factorToBase: 1000, label: "l" },
  UN: { dimension: "COUNT", factorToBase: 1, label: "un" },
};

export const ALL_UNITS = Object.keys(UNIT_METADATA) as Unit[];

/**
 * Read-only conversion. There is no `toBase` on purpose: the API takes
 * `quantity` and `unit` raw and converts with `Prisma.Decimal`, so multiplying
 * here would reintroduce floating-point noise on a path that is exact today.
 */
export function fromBase(base: number, unit: Unit): number {
  return base / UNIT_METADATA[unit].factorToBase;
}

export function unitsOfDimension(unit: Unit): Unit[] {
  const { dimension } = UNIT_METADATA[unit];
  return ALL_UNITS.filter((candidate) => UNIT_METADATA[candidate].dimension === dimension);
}

export function unitLabel(unit: Unit): string {
  return UNIT_METADATA[unit].label;
}

/** For a value already expressed in `unit` — a purchase quantity, a form input. */
export function formatWithUnit(value: number, unit: Unit): string {
  return `${formatQuantity(value)} ${unitLabel(unit)}`;
}

/** For a value the API stores in the base unit — a balance, a movement. */
export function formatInUnit(base: number, unit: Unit): string {
  return formatWithUnit(fromBase(base, unit), unit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/unit.test.ts`
Expected: PASS, 8 testes.

Se falhar só no caractere do sinal negativo, **não mude a implementação**: verifique o que o `Intl.NumberFormat("pt-BR")`
devolve de fato e corrija a expectativa do teste. O formatador é a fonte, não a suposição.

- [ ] **Step 5: Commit**

```bash
npm run lint:prettier:fix
git add src/lib/unit.ts src/lib/unit.test.ts
git commit -m "feat(unit): convert the API base unit to the unit a supply is bought in"
```

---

### Task 3: Módulo de API e hooks de insumo

O acesso a `/supplies` e as queries, sem tela. Espelha o que a fatia 5 fez em `roles.api.ts` e `use-roles.ts`.

**Files:**

- Create: `src/features/supplies/supplies.api.ts`
- Create: `src/features/supplies/use-supplies.ts`
- Create: `src/features/supplies/use-supply.ts`
- Create: `src/features/supplies/use-supply-mutations.ts`
- Test: `src/features/supplies/supplies.api.test.ts`

**Interfaces:**

- Consumes: `request`, `ApiError` de `@/lib/http`; `paths` de `@/lib/api.types`
- Produces:
  ```ts
  type Supply = paths["/supplies"]["get"]["responses"][200]["content"]["application/json"][number];
  type CreateSupplyInput = paths["/supplies"]["post"]["requestBody"]["content"]["application/json"];
  type UpdateSupplyInput = paths["/supplies/{id}"]["patch"]["requestBody"]["content"]["application/json"];
  function fetchSupplies(): Promise<Supply[]>;
  function fetchSupply(id: string): Promise<Supply>;
  function createSupply(input: CreateSupplyInput): Promise<Supply>;
  function updateSupply(id: string, input: UpdateSupplyInput): Promise<Supply>;
  function deleteSupply(id: string): Promise<void>;
  const SUPPLIES_QUERY_KEY: readonly ["supplies"];
  function supplyQueryKey(id: string): readonly ["supplies", string];
  function useSupplies(): UseQueryResult<Supply[]>;
  function useSupply(id: string | undefined): UseQueryResult<Supply>;
  function useCreateSupply(): UseMutationResult<Supply, unknown, CreateSupplyInput>;
  function useUpdateSupply(id: string): UseMutationResult<Supply, unknown, UpdateSupplyInput>;
  function useDeleteSupply(): UseMutationResult<void, unknown, string>;
  function useInvalidateSupplies(): () => void;
  ```

- [ ] **Step 1: Write the failing test**

`src/features/supplies/supplies.api.test.ts`:

```ts
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createSupply, deleteSupply, fetchSupplies, fetchSupply, updateSupply } from "@/features/supplies/supplies.api";
import { ApiError } from "@/lib/http";
import { clearSession, setAccessToken } from "@/lib/tokens";
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

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("supplies.api", () => {
  test("fetchSupplies returns the list", async () => {
    server.use(msw.get(`${API}/supplies`, () => HttpResponse.json([supply])));

    await expect(fetchSupplies()).resolves.toEqual([supply]);
  });

  test("fetchSupply asks for one by id", async () => {
    server.use(msw.get(`${API}/supplies/${supply.id}`, () => HttpResponse.json(supply)));

    await expect(fetchSupply(supply.id)).resolves.toEqual(supply);
  });

  test("createSupply posts the five fields", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(supply, { status: 201 });
      }),
    );

    await createSupply({ name: "Farinha de trigo", type: "INGREDIENT", purchaseUnit: "KG", purchaseQty: 5, purchasePrice: 24 });

    expect(body).toEqual({
      name: "Farinha de trigo",
      type: "INGREDIENT",
      purchaseUnit: "KG",
      purchaseQty: 5,
      purchasePrice: 24,
    });
  });

  test("updateSupply patches", async () => {
    let method: string | undefined;
    server.use(
      msw.patch(`${API}/supplies/${supply.id}`, ({ request }) => {
        method = request.method;
        return HttpResponse.json(supply);
      }),
    );

    await updateSupply(supply.id, { purchasePrice: 26 });

    expect(method).toBe("PATCH");
  });

  test("deleteSupply resolves on the 204", async () => {
    server.use(msw.delete(`${API}/supplies/${supply.id}`, () => new HttpResponse(null, { status: 204 })));

    await expect(deleteSupply(supply.id)).resolves.toBeUndefined();
  });

  // Both `RecipeItem.supplyId` and `StockMovement.supplyId` are `onDelete:
  // Restrict` in the API's schema, so a supply that ever moved can never be
  // deleted. The status has to reach the caller for the screen to say why.
  test("deleteSupply rejects with the 409 status when the supply is referenced", async () => {
    server.use(
      msw.delete(`${API}/supplies/${supply.id}`, () =>
        HttpResponse.json({ message: "Operação viola uma referência existente" }, { status: 409 }),
      ),
    );

    await expect(deleteSupply(supply.id)).rejects.toMatchObject({ status: 409 });
    await expect(deleteSupply(supply.id)).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/supplies/supplies.api.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/supplies/supplies.api"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/supplies/supplies.api.ts`:

```ts
import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type Supply = paths["/supplies"]["get"]["responses"][200]["content"]["application/json"][number];
export type CreateSupplyInput = paths["/supplies"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateSupplyInput = paths["/supplies/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function fetchSupplies(): Promise<Supply[]> {
  return request<Supply[]>("/supplies");
}

export function fetchSupply(id: string): Promise<Supply> {
  return request<Supply>(`/supplies/${id}`);
}

export function createSupply(input: CreateSupplyInput): Promise<Supply> {
  return request<Supply>("/supplies", { method: "POST", body: JSON.stringify(input) });
}

export function updateSupply(id: string, input: UpdateSupplyInput): Promise<Supply> {
  return request<Supply>(`/supplies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteSupply(id: string): Promise<void> {
  return request<void>(`/supplies/${id}`, { method: "DELETE" });
}
```

`src/features/supplies/use-supplies.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchSupplies, type Supply } from "@/features/supplies/supplies.api";

export const SUPPLIES_QUERY_KEY = ["supplies"] as const;

/** Serves both `/supplies` and `/stock`: the same GET, one cache. */
export function useSupplies() {
  return useQuery<Supply[]>({ queryKey: SUPPLIES_QUERY_KEY, queryFn: fetchSupplies });
}
```

`src/features/supplies/use-supply.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchSupply, type Supply } from "@/features/supplies/supplies.api";

export function supplyQueryKey(id: string) {
  return ["supplies", id] as const;
}

export function useSupply(id: string | undefined) {
  return useQuery<Supply>({
    queryKey: supplyQueryKey(id ?? ""),
    queryFn: () => fetchSupply(id!),
    enabled: Boolean(id),
  });
}
```

`src/features/supplies/use-supply-mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSupply,
  deleteSupply,
  updateSupply,
  type CreateSupplyInput,
  type Supply,
  type UpdateSupplyInput,
} from "@/features/supplies/supplies.api";
import { SUPPLIES_QUERY_KEY } from "@/features/supplies/use-supplies";

/**
 * Coarse by key hierarchy: `["supplies"]` is a prefix of `["supplies", id]` and
 * of the ledger key, so one call reaches the list, the detail and the movements
 * of every supply. Nothing here touches `["me"]` — no screen in this slice
 * changes the permissions of whoever is logged in.
 */
export function useInvalidateSupplies() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: SUPPLIES_QUERY_KEY });
  };
}

export function useCreateSupply() {
  const invalidate = useInvalidateSupplies();

  return useMutation<Supply, unknown, CreateSupplyInput>({ mutationFn: createSupply, onSuccess: invalidate });
}

export function useUpdateSupply(id: string) {
  const invalidate = useInvalidateSupplies();

  return useMutation<Supply, unknown, UpdateSupplyInput>({
    mutationFn: (input) => updateSupply(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSupply() {
  const invalidate = useInvalidateSupplies();

  return useMutation<void, unknown, string>({ mutationFn: deleteSupply, onSuccess: invalidate });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/supplies/supplies.api.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
npm run lint:prettier:fix
git add src/features/supplies
git commit -m "feat(supplies): add the supplies API module and query hooks"
```

---

### Task 4: A lista de insumos

O cadastro: nome, tipo, o que se compra, preço, e a exclusão com confirmação. É a primeira tela desta fatia, então
também é ela que tira `/supplies` do placeholder.

**Files:**

- Create: `src/features/supplies/supply-labels.ts`
- Create: `src/features/supplies/SuppliesListPage.tsx`
- Test: `src/features/supplies/SuppliesListPage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`

**Interfaces:**

- Consumes: `useSupplies`, `useDeleteSupply`, `Supply` da Task 3; `formatWithUnit` da Task 2; `formatCurrency` de
  `@/lib/format`; `PageHeader`, `QueryErrorState`, `ConfirmDialog`; `hasPermission`, `useSession`
- Produces: `SUPPLY_TYPE_LABELS: Record<Supply["type"], string>`, `SuppliesListPage`

- [ ] **Step 1: Write the failing test**

`src/features/supplies/SuppliesListPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { SuppliesListPage } from "@/features/supplies/SuppliesListPage";
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

function renderList(permissions: string[]) {
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
    msw.get(`${API}/supplies`, () => HttpResponse.json([supply])),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/supplies" element={<SuppliesListPage />} />
      </Routes>
    </>,
    { route: "/supplies" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("SuppliesListPage", () => {
  test("shows the name, the type, what is bought and the price", async () => {
    renderList(["SUPPLIES_READ", "SUPPLIES_WRITE"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;

    expect(row).toHaveTextContent("Ingrediente");
    expect(row).toHaveTextContent("5 kg");
    expect(row).toHaveTextContent("R$ 24,00");
  });

  test("deleting asks first and only calls the API after confirmation", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/supplies/${supply.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderList(["SUPPLIES_READ", "SUPPLIES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    expect(deleted).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir insumo$/i }));

    expect(deleted).toBe(true);
  });

  // The API answers any FK violation with "Operação viola uma referência
  // existente", which does not tell the person what to do. The screen names the
  // only two references the schema allows.
  test("a 409 on deletion explains that the supply already moved or is in a recipe", async () => {
    server.use(
      msw.delete(`${API}/supplies/${supply.id}`, () =>
        HttpResponse.json({ message: "Operação viola uma referência existente" }, { status: 409 }),
      ),
    );
    renderList(["SUPPLIES_READ", "SUPPLIES_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^excluir insumo$/i }));

    expect(await screen.findByText(/movimentação de estoque ou que faz parte de uma receita/i)).toBeInTheDocument();
    expect(screen.getByText("Farinha de trigo")).toBeInTheDocument();
  });

  test("hides the write actions from a read-only reader", async () => {
    renderList(["SUPPLIES_READ"]);

    expect(await screen.findByText("Farinha de trigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /novo insumo/i })).not.toBeInTheDocument();
  });

  test("says so when there is nothing registered", async () => {
    server.use(msw.get(`${API}/supplies`, () => HttpResponse.json([])));
    renderList(["SUPPLIES_READ"]);

    expect(await screen.findByText(/nenhum insumo cadastrado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/supplies/SuppliesListPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/supplies/SuppliesListPage"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/supplies/supply-labels.ts`:

```ts
import type { Supply } from "@/features/supplies/supplies.api";

/**
 * Exhaustive on purpose: a supply type added to the API makes tsc fail here
 * until someone writes the Portuguese label.
 */
export const SUPPLY_TYPE_LABELS: Record<Supply["type"], string> = {
  INGREDIENT: "Ingrediente",
  PACKAGING: "Embalagem",
};
```

`src/features/supplies/SuppliesListPage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { SUPPLY_TYPE_LABELS } from "@/features/supplies/supply-labels";
import { useDeleteSupply } from "@/features/supplies/use-supply-mutations";
import { useSupplies } from "@/features/supplies/use-supplies";
import { formatCurrency } from "@/lib/format";
import { ApiError } from "@/lib/http";
import { formatWithUnit } from "@/lib/unit";

/**
 * `RecipeItem.supplyId` and `StockMovement.supplyId` are both `onDelete:
 * Restrict` in the API's schema, so those are the only two references a 409 can
 * mean. The API's own sentence names neither; here the precision is legitimate.
 */
function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "Não é possível excluir um insumo que já tem movimentação de estoque ou que faz parte de uma receita.";
  }
  if (error instanceof ApiError) return error.message;
  return "Não foi possível excluir. Verifique sua conexão.";
}

export function SuppliesListPage() {
  const supplies = useSupplies();
  const deleteSupply = useDeleteSupply();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "SUPPLIES_WRITE");
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (supplies.isError) return <QueryErrorState error={supplies.error} onRetry={() => void supplies.refetch()} />;
  if (!supplies.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  function onConfirmDelete() {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    deleteSupply.mutate(id, { onError: (error) => toast.error(toastMessageFor(error)) });
  }

  return (
    <section className="p-8">
      <PageHeader title="Insumos">
        {canWrite && (
          <Link to="/supplies/new" className={buttonVariants({ size: "sm" })}>
            Novo insumo
          </Link>
        )}
      </PageHeader>

      {supplies.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum insumo cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Compra</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplies.data.map((supply) => (
              <TableRow key={supply.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/supplies/${supply.id}`} className="underline-offset-2 hover:underline">
                      {supply.name}
                    </Link>
                  ) : (
                    supply.name
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{SUPPLY_TYPE_LABELS[supply.type]}</Badge>
                </TableCell>
                {/* `purchaseQty` is already in `purchaseUnit` — it is not a base
                    quantity, so it is formatted without converting. */}
                <TableCell className="tabular-nums">{formatWithUnit(supply.purchaseQty, supply.purchaseUnit)}</TableCell>
                <TableCell className="tabular-nums">{formatCurrency(supply.purchasePrice)}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(supply.id)}>
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
        title="Excluir insumo"
        description="Só é possível excluir um insumo que nunca foi movimentado e não faz parte de nenhuma receita. Não dá para desfazer."
        confirmLabel="Excluir insumo"
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
```

Se o `Badge` não aceitar `variant="secondary"`, abra `src/components/ui/badge.tsx` e use uma variante que exista — não
invente uma nova.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/supplies/SuppliesListPage.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 5: Wire the route**

Em `src/app/router.tsx`, acrescentar `"/supplies"` ao `BUILT_ROUTES` e declarar a rota de leitura:

```tsx
const BUILT_ROUTES = new Set(["/supplies", "/users", "/roles"]);
```

E, dentro do `RequireSession`, um bloco novo ao lado dos existentes:

```tsx
{
  element: <RequirePermission permission="SUPPLIES_READ" />,
  errorElement: <RouteError />,
  children: [{ path: "/supplies", element: <SuppliesListPage /> }],
},
```

Com o import `import { SuppliesListPage } from "@/features/supplies/SuppliesListPage";`.

- [ ] **Step 6: Run the router test**

Run: `npx vitest run src/app/router.test.tsx`
Expected: PASS. O teste `%s resolves to a route` já cobre `/supplies` — ele agora resolve na tela real em vez do
placeholder, e continua passando.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
npm run lint:prettier:fix
git add src/features/supplies src/app/router.tsx
git commit -m "feat(supplies): add the supplies list with confirmed deletion"
```

---

### Task 5: O formulário de insumo

Serve criar e editar. Traz o `NativeSelect`, o primeiro componente de seleção reusável do repositório.

**Files:**

- Create: `src/components/ui/native-select.tsx`
- Create: `src/features/supplies/SupplyFormPage.tsx`
- Test: `src/features/supplies/SupplyFormPage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`

**Interfaces:**

- Consumes: `useSupply`, `useCreateSupply`, `useUpdateSupply` da Task 3; `ALL_UNITS`, `unitLabel` da Task 2;
  `isFormError` de `@/lib/form-errors`
- Produces: `NativeSelect` (props de `<select>` mais `id: string`), `SupplyFormPage`

**Nota de desvio da spec:** a spec falava em trazer o `select` do shadcn. Ao ler o repositório, `UserFormPage` usa um
`<select>` nativo estilizado com Tailwind — o `select` do shadcn nunca foi adicionado. Três selects nesta fatia
justificam extrair o padrão que já existe, não trocá-lo por uma primitiva de listbox: o nativo funciona com
`userEvent.selectOptions` no jsdom sem portal nem `matchMedia`. O arquivo se chama `native-select.tsx`, e não
`select.tsx`, para não colidir com o que o `npx shadcn add select` geraria depois.

- [ ] **Step 1: Write the failing test**

`src/features/supplies/SupplyFormPage.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/supplies/SupplyFormPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/supplies/SupplyFormPage"`.

- [ ] **Step 3: Write minimal implementation**

`src/components/ui/native-select.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The styled native `<select>` that UserFormPage inlined. Extracted here now
 * that three screens need one. Native, not a listbox primitive: it needs no
 * portal, and `userEvent.selectOptions` drives it in jsdom without a stand-in.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
```

`src/features/supplies/SupplyFormPage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentProps, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SUPPLY_TYPE_LABELS } from "@/features/supplies/supply-labels";
import { useCreateSupply, useUpdateSupply } from "@/features/supplies/use-supply-mutations";
import { useSupply } from "@/features/supplies/use-supply";
import { isFormError } from "@/lib/form-errors";
import { ApiError } from "@/lib/http";
import { ALL_UNITS, unitLabel } from "@/lib/unit";

/**
 * Mirrors the API's Zod so the error shows before the round trip:
 * `purchaseQty` is positive, `purchasePrice` is non-negative — free is valid.
 */
const supplySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  type: z.enum(["INGREDIENT", "PACKAGING"]),
  purchaseUnit: z.enum(["G", "KG", "ML", "L", "UN"]),
  purchaseQty: z.coerce.number().positive("Informe uma quantidade maior que zero"),
  purchasePrice: z.coerce.number().nonnegative("O preço não pode ser negativo"),
});

type SupplyForm = z.infer<typeof supplySchema>;

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

export function SupplyFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const supply = useSupply(id);
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply(id ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplyForm>({
    resolver: zodResolver(supplySchema),
    defaultValues: { type: "INGREDIENT", purchaseUnit: "KG" },
  });

  // Seeds the form once the API answers. `reset`, not `setValue`, so the fields
  // also stop counting as dirty.
  useEffect(() => {
    if (!isEditing || !supply.data) return;
    reset({
      name: supply.data.name,
      type: supply.data.type,
      purchaseUnit: supply.data.purchaseUnit,
      purchaseQty: supply.data.purchaseQty,
      purchasePrice: supply.data.purchasePrice,
    });
  }, [isEditing, supply.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      if (isEditing) await updateSupply.mutateAsync(values);
      else await createSupply.mutateAsync(values);
      navigate("/supplies", { replace: true });
    } catch (error) {
      if (isFormError(error)) setFormError((error as ApiError).message);
      else toast.error(toastMessageFor(error));
    }
  });

  if (supply.isError) {
    return (
      <section className="p-8">
        <QueryErrorState error={supply.error} onRetry={() => void supply.refetch()} />
        <Link to="/supplies" className="mt-4 inline-block text-sm underline">
          Voltar para insumos
        </Link>
      </section>
    );
  }
  if (isEditing && !supply.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title={isEditing ? supply.data!.name : "Novo insumo"} />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />

          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo</Label>
            <NativeSelect id="type" {...register("type")}>
              {(Object.keys(SUPPLY_TYPE_LABELS) as (keyof typeof SUPPLY_TYPE_LABELS)[]).map((type) => (
                <option key={type} value={type}>
                  {SUPPLY_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchaseUnit">Unidade de compra</Label>
            {/* All five: here the choice IS the declaration of the supply's
                dimension, so there is no prior dimension to respect. */}
            <NativeSelect id="purchaseUnit" {...register("purchaseUnit")}>
              {ALL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabel(unit)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <Field
            id="purchaseQty"
            label="Quantidade comprada"
            type="number"
            step="any"
            error={errors.purchaseQty?.message}
            {...register("purchaseQty")}
          />
          <Field
            id="purchasePrice"
            label="Preço de compra"
            type="number"
            step="any"
            error={errors.purchasePrice?.message}
            {...register("purchasePrice")}
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Salvar
          </Button>
          <Link to="/supplies" className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/supplies/SupplyFormPage.test.tsx`
Expected: PASS, 5 testes.

Se o `z.coerce.number()` reclamar de tipo com o `zodResolver` no Zod 4, tipe o formulário pela entrada:
`useForm<z.input<typeof supplySchema>, unknown, SupplyForm>`. Não troque `coerce` por conversão manual no `onSubmit` —
o campo `<input type="number">` entrega string, e a coerção é o que mantém a validação e o envio de acordo.

- [ ] **Step 5: Wire the routes**

Em `src/app/router.tsx`, criar um bloco próprio ao lado dos existentes. Não reaproveite o bloco de `USERS_WRITE`: a
permissão destas rotas é outra.

```tsx
{
  element: <RequirePermission permission="SUPPLIES_WRITE" />,
  errorElement: <RouteError />,
  children: [
    // Static before dynamic: `/supplies/new` must not be read as an id.
    { path: "/supplies/new", element: <SupplyFormPage /> },
    { path: "/supplies/:id", element: <SupplyFormPage /> },
  ],
},
```

Com o import `import { SupplyFormPage } from "@/features/supplies/SupplyFormPage";`.

- [ ] **Step 6: Extend the router test**

Em `src/app/router.test.tsx`, acrescentar `/supplies/new` à lista do `test.each` que checa o 403, e um handler para
`/supplies`:

```tsx
test.each(["/users/new", "/roles/new", "/supplies/new"])(
  "%s shows the forbidden screen to a read-only user",
  async (path) => {
```

e, dentro do `server.use` daquele teste, mais uma linha:

```tsx
msw.get(`${API}/supplies`, () => HttpResponse.json([])),
```

- [ ] **Step 7: Run the router test**

Run: `npx vitest run src/app/router.test.tsx`
Expected: PASS. O usuário do teste tem só `USERS_READ`, então `/supplies/new` cai no 403.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
npm run lint:prettier:fix
git add src/components/ui/native-select.tsx src/features/supplies src/app/router.tsx src/app/router.test.tsx
git commit -m "feat(supplies): add the supply form for creating and editing"
```

---

### Task 6: Módulo de API e hooks de estoque

A entrada e o razão paginado. É aqui que o `nextCursor` da Task 1 vira `useInfiniteQuery`.

**Files:**

- Create: `src/features/stock/stock.api.ts`
- Create: `src/features/stock/use-movements.ts`
- Create: `src/features/stock/use-stock-mutations.ts`
- Create: `src/features/stock/movement-labels.ts`
- Test: `src/features/stock/stock.api.test.ts`

**Interfaces:**

- Consumes: `request` de `@/lib/http`; `paths` de `@/lib/api.types`; `SUPPLIES_QUERY_KEY` da Task 3
- Produces:
  ```ts
  type MovementPage = paths["/supplies/{id}/movements"]["get"]["responses"][200]["content"]["application/json"];
  type Movement = MovementPage["data"][number];
  type CreateStockEntryInput = paths["/supplies/{id}/stock-entries"]["post"]["requestBody"]["content"]["application/json"];
  type StockEntryResult = paths["/supplies/{id}/stock-entries"]["post"]["responses"][201]["content"]["application/json"];
  function fetchMovements(supplyId: string, cursor?: string): Promise<MovementPage>;
  function createStockEntry(supplyId: string, input: CreateStockEntryInput): Promise<StockEntryResult>;
  function movementsQueryKey(supplyId: string): readonly ["supplies", string, "movements"];
  function useMovements(supplyId: string | undefined): UseInfiniteQueryResult<InfiniteData<MovementPage>>;
  function useCreateStockEntry(): UseMutationResult<StockEntryResult, unknown, { supplyId: string } & CreateStockEntryInput>;
  const MOVEMENT_TYPE_LABELS: Record<Movement["type"], string>;
  ```

- [ ] **Step 1: Write the failing test**

`src/features/stock/stock.api.test.ts`:

```ts
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createStockEntry, fetchMovements } from "@/features/stock/stock.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const SUPPLY_ID = "33333333-3333-4333-8333-333333333333";

const movement = {
  id: "44444444-4444-4444-8444-444444444444",
  supplyId: SUPPLY_ID,
  type: "ENTRY",
  quantityBase: 5000,
  reason: null,
  note: "Nota 123",
  productionId: null,
  createdAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("stock.api", () => {
  test("fetchMovements returns the page envelope, not a bare array", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () =>
        HttpResponse.json({ data: [movement], nextCursor: null }),
      ),
    );

    await expect(fetchMovements(SUPPLY_ID)).resolves.toEqual({ data: [movement], nextCursor: null });
  });

  test("the first page asks for no cursor", async () => {
    let cursor: string | null = "not-read";
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, ({ request }) => {
        cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await fetchMovements(SUPPLY_ID);

    expect(cursor).toBeNull();
  });

  test("a later page carries the cursor it was given", async () => {
    let cursor: string | null = null;
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, ({ request }) => {
        cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({ data: [], nextCursor: null });
      }),
    );

    await fetchMovements(SUPPLY_ID, movement.id);

    expect(cursor).toBe(movement.id);
  });

  // The API takes quantity and unit raw and converts with Decimal. Multiplying
  // here would put floating-point noise on a path that is exact today.
  test("createStockEntry sends the quantity and unit raw, without converting to the base", async () => {
    let body: unknown;
    server.use(
      msw.post(`${API}/supplies/${SUPPLY_ID}/stock-entries`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ movement, currentStock: 17500 }, { status: 201 });
      }),
    );

    const result = await createStockEntry(SUPPLY_ID, { quantity: 5, unit: "KG", note: "Nota 123" });

    expect(body).toEqual({ quantity: 5, unit: "KG", note: "Nota 123" });
    expect(result.currentStock).toBe(17500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/stock/stock.api.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/stock/stock.api"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/stock/stock.api.ts`:

```ts
import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type MovementPage = paths["/supplies/{id}/movements"]["get"]["responses"][200]["content"]["application/json"];
export type Movement = MovementPage["data"][number];
export type CreateStockEntryInput =
  paths["/supplies/{id}/stock-entries"]["post"]["requestBody"]["content"]["application/json"];
export type StockEntryResult =
  paths["/supplies/{id}/stock-entries"]["post"]["responses"][201]["content"]["application/json"];

/** The ledger is append-only and paginated by cursor, newest first. */
export function fetchMovements(supplyId: string, cursor?: string): Promise<MovementPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<MovementPage>(`/supplies/${supplyId}/movements${query}`);
}

export function createStockEntry(supplyId: string, input: CreateStockEntryInput): Promise<StockEntryResult> {
  return request<StockEntryResult>(`/supplies/${supplyId}/stock-entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

`src/features/stock/movement-labels.ts`:

```ts
import type { Movement } from "@/features/stock/stock.api";

/**
 * Exhaustive on purpose: a movement type added to the API makes tsc fail here
 * until someone writes the Portuguese label.
 */
export const MOVEMENT_TYPE_LABELS: Record<Movement["type"], string> = {
  ENTRY: "Entrada",
  PRODUCTION: "Produção",
  WASTE: "Perda",
};
```

`src/features/stock/use-movements.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchMovements, type MovementPage } from "@/features/stock/stock.api";

export function movementsQueryKey(supplyId: string) {
  return ["supplies", supplyId, "movements"] as const;
}

/**
 * No infinite scroll: the ledger is something a person reads while checking,
 * and loading without being asked gets in the way. `nextCursor` comes back
 * `null` at the end, which turns the button off.
 */
export function useMovements(supplyId: string | undefined) {
  return useInfiniteQuery({
    queryKey: movementsQueryKey(supplyId ?? ""),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchMovements(supplyId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: MovementPage) => last.nextCursor ?? undefined,
    enabled: Boolean(supplyId),
  });
}
```

`src/features/stock/use-stock-mutations.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import {
  createStockEntry,
  type CreateStockEntryInput,
  type StockEntryResult,
} from "@/features/stock/stock.api";
import { useInvalidateSupplies } from "@/features/supplies/use-supply-mutations";

/**
 * `supplyId` travels with the variables rather than with the hook: the dialog
 * is opened for a different supply on every row of the list.
 *
 * One invalidation is enough. `["supplies"]` is a prefix of the ledger key, so
 * it refreshes the balances and that supply's movements in one call.
 */
export function useCreateStockEntry() {
  const invalidate = useInvalidateSupplies();

  return useMutation<StockEntryResult, unknown, { supplyId: string } & CreateStockEntryInput>({
    mutationFn: ({ supplyId, ...input }) => createStockEntry(supplyId, input),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/stock/stock.api.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
npm run lint:prettier:fix
git add src/features/stock
git commit -m "feat(stock): add the stock API module, the paginated ledger query and the entry mutation"
```

---

### Task 7: A lista de saldos

A tela de operação: saldo por insumo na unidade de compra, saldo negativo marcado, e a porta para o razão. O botão de
entrada aparece aqui mas só ganha diálogo na Task 8 — nesta tarefa ele ainda não faz nada, e é isso que o teste afirma.

**Files:**

- Create: `src/features/stock/StockListPage.tsx`
- Test: `src/features/stock/StockListPage.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**

- Consumes: `useSupplies`, `Supply` da Task 3; `formatInUnit` da Task 2; `hasPermission`, `useSession`
- Produces: `StockListPage`

- [ ] **Step 1: Write the failing test**

`src/features/stock/StockListPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { StockListPage } from "@/features/stock/StockListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const flour = {
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

const box = {
  ...flour,
  id: "55555555-5555-4555-8555-555555555555",
  name: "Caixa de bolo",
  type: "PACKAGING",
  purchaseUnit: "UN",
  currentStock: -3,
};

function renderList(permissions: string[], supplies: unknown[] = [flour, box]) {
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
    msw.get(`${API}/supplies`, () => HttpResponse.json(supplies)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/stock" element={<StockListPage />} />
    </Routes>,
    { route: "/stock" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("StockListPage", () => {
  test("shows the balance in the unit the supply is bought in, not the base", async () => {
    renderList(["STOCK_READ", "STOCK_WRITE"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;

    expect(row).toHaveTextContent("12,5 kg");
    expect(row).not.toHaveTextContent("12500");
  });

  // A production may consume more than there is: the API records it and warns
  // instead of refusing, so this is a state the screen must show, not an edge case.
  test("marks a negative balance", async () => {
    renderList(["STOCK_READ"]);

    const row = (await screen.findByText("Caixa de bolo")).closest("tr")!;
    const balance = row.querySelector("[data-negative]")!;

    expect(balance).toHaveAttribute("data-negative", "true");
    expect(balance).toHaveTextContent("-3 un");
  });

  test("a positive balance is not marked", async () => {
    renderList(["STOCK_READ"]);

    const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;

    expect(row.querySelector("[data-negative]")).toHaveAttribute("data-negative", "false");
  });

  test("each supply links to its own ledger", async () => {
    renderList(["STOCK_READ"]);

    expect(await screen.findByRole("link", { name: "Farinha de trigo" })).toHaveAttribute(
      "href",
      `/stock/${flour.id}`,
    );
  });

  // The entry lives in a dialog inside a read route, so there is no route gate
  // to raise here. The button hiding is convenience; the API is the real gate.
  test("hides the entry button from someone who cannot write stock", async () => {
    renderList(["STOCK_READ"]);

    expect(await screen.findByText("Farinha de trigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrada/i })).not.toBeInTheDocument();
  });

  test("shows the entry button to someone who can", async () => {
    renderList(["STOCK_READ", "STOCK_WRITE"]);

    expect(await screen.findAllByRole("button", { name: /entrada/i })).toHaveLength(2);
  });

  test("says so when there is nothing registered", async () => {
    renderList(["STOCK_READ"], []);

    expect(await screen.findByText(/nenhum insumo cadastrado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/stock/StockListPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/stock/StockListPage"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/stock/StockListPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { useSupplies } from "@/features/supplies/use-supplies";
import { formatInUnit } from "@/lib/unit";

export function StockListPage() {
  const supplies = useSupplies();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "STOCK_WRITE");

  if (supplies.isError) return <QueryErrorState error={supplies.error} onRetry={() => void supplies.refetch()} />;
  if (!supplies.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title="Estoque" />

      {supplies.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum insumo cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplies.data.map((supply) => (
              <TableRow key={supply.id}>
                <TableCell className="font-medium">
                  <Link to={`/stock/${supply.id}`} className="underline-offset-2 hover:underline">
                    {supply.name}
                  </Link>
                </TableCell>
                <TableCell
                  data-negative={supply.currentStock < 0}
                  className="tabular-nums data-[negative=true]:text-destructive"
                >
                  {formatInUnit(supply.currentStock, supply.purchaseUnit)}
                </TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <Button variant="ghost" size="sm">
                      Entrada
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/stock/StockListPage.test.tsx`
Expected: PASS, 7 testes.

- [ ] **Step 5: Wire the route**

Em `src/app/router.tsx`, acrescentar `"/stock"` ao `BUILT_ROUTES` e declarar o bloco:

```tsx
const BUILT_ROUTES = new Set(["/supplies", "/stock", "/users", "/roles"]);
```

```tsx
{
  element: <RequirePermission permission="STOCK_READ" />,
  errorElement: <RouteError />,
  children: [{ path: "/stock", element: <StockListPage /> }],
},
```

Com o import `import { StockListPage } from "@/features/stock/StockListPage";`.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
npm run lint:prettier:fix
git add src/features/stock src/app/router.tsx
git commit -m "feat(stock): add the balances list with the ledger link"
```

---

### Task 8: O diálogo de entrada

Traz o `Dialog` — o `alert-dialog` que já existe tem papel de interrupção, e um formulário dentro de um `alertdialog`
é semanticamente errado para quem usa leitor de tela.

**Files:**

- Create: `src/components/ui/dialog.tsx`
- Create: `src/features/stock/StockEntryDialog.tsx`
- Test: `src/features/stock/StockEntryDialog.test.tsx`
- Modify: `src/features/stock/StockListPage.tsx`
- Modify: `src/features/stock/StockListPage.test.tsx`

**Interfaces:**

- Consumes: `useCreateStockEntry` da Task 6; `unitsOfDimension`, `unitLabel`, `formatInUnit` da Task 2; `NativeSelect`
  da Task 5; `Supply` da Task 3
- Produces: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`;
  `StockEntryDialog` com as props
  ```ts
  interface StockEntryDialogProps {
    supply: Supply | null;
    onOpenChange: (open: boolean) => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

`src/features/stock/StockEntryDialog.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { StockEntryDialog } from "@/features/stock/StockEntryDialog";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const flour = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Farinha de trigo",
  type: "INGREDIENT" as const,
  purchaseUnit: "KG" as const,
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

const box = { ...flour, id: "55555555-5555-4555-8555-555555555555", name: "Caixa", purchaseUnit: "UN" as const };

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

function renderDialog(supply: typeof flour) {
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
        return HttpResponse.json({ movement, currentStock: 17500 }, { status: 201 });
      }),
    );
    renderDialog(flour);

    await userEvent.type(await screen.findByLabelText(/quantidade/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /lançar entrada/i }));

    expect(await screen.findByText(/17,5 kg/)).toBeInTheDocument();
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
        HttpResponse.json({ movement, currentStock: 17500 }, { status: 201 }),
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

    expect(await screen.findByText(/17,5 kg/)).toBeInTheDocument();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/stock/StockEntryDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/stock/StockEntryDialog"`.

- [ ] **Step 3: Write minimal implementation**

`src/components/ui/dialog.tsx` — espelha a estrutura de `src/components/ui/alert-dialog.tsx`, trocando a primitiva:

```tsx
import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({ className, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("grid gap-1.5", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function DialogClose({
  className,
  variant = "outline",
  size = "default",
  ...props
}: DialogPrimitive.Close.Props & Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
};
```

Se algum nome de parte não existir em `@base-ui/react/dialog`, abra `node_modules/@base-ui/react/dialog/index.d.ts` e
use o que estiver lá. Não invente parte, e não caia de volta no `alert-dialog`.

`src/features/stock/StockEntryDialog.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateStockEntry } from "@/features/stock/use-stock-mutations";
import type { Supply } from "@/features/supplies/supplies.api";
import { ApiError } from "@/lib/http";
import { formatInUnit, unitLabel, unitsOfDimension } from "@/lib/unit";

const entrySchema = z.object({
  quantity: z.coerce.number().positive("Informe uma quantidade maior que zero"),
  unit: z.enum(["G", "KG", "ML", "L", "UN"]),
  note: z.string().trim().optional(),
});

type EntryForm = z.infer<typeof entrySchema>;

interface StockEntryDialogProps {
  /** The supply the entry is for; `null` keeps the dialog closed. */
  supply: Supply | null;
  onOpenChange: (open: boolean) => void;
}

function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível lançar a entrada. Verifique sua conexão.";
}

export function StockEntryDialog({ supply, onOpenChange }: StockEntryDialogProps) {
  const createEntry = useCreateStockEntry();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EntryForm>({ resolver: zodResolver(entrySchema) });

  // Reopening for another supply must not carry the previous numbers, and the
  // default unit is the one that supply is bought in.
  useEffect(() => {
    if (!supply) return;
    reset({ quantity: undefined, unit: supply.purchaseUnit, note: "" });
  }, [supply, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!supply) return;

    try {
      const result = await createEntry.mutateAsync({
        supplyId: supply.id,
        quantity: values.quantity,
        unit: values.unit,
        // The API's Zod has `note` optional, not nullable: an empty field is
        // an absent field, not an empty string.
        ...(values.note ? { note: values.note } : {}),
      });
      toast.success(`Entrada lançada. Saldo agora: ${formatInUnit(result.currentStock, supply.purchaseUnit)}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(toastMessageFor(error));
    }
  });

  return (
    <Dialog open={supply !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de estoque</DialogTitle>
          <DialogDescription>{supply?.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                aria-invalid={!!errors.quantity}
                {...register("quantity")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unit">Unidade</Label>
              {/* Only the supply's dimension: the API refuses the rest, and a
                  select that offers a path which always fails is a trap. */}
              <NativeSelect id="unit" {...register("unit")}>
                {(supply ? unitsOfDimension(supply.purchaseUnit) : []).map((unit) => (
                  <option key={unit} value={unit}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {errors.quantity && (
            <p role="alert" className="text-sm text-destructive">
              {errors.quantity.message}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="note">Observação</Label>
            <Input id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <DialogClose type="button">Cancelar</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              Lançar entrada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/stock/StockEntryDialog.test.tsx`
Expected: PASS, 7 testes.

Se o diálogo não aparecer no jsdom por causa do portal, verifique se `screen` está buscando em `document.body` — é o
padrão da Testing Library e o portal do base-ui monta lá. Não substitua o portal por render inline.

- [ ] **Step 5: Hook the dialog into the balances list**

Em `src/features/stock/StockListPage.tsx`, guardar o insumo selecionado e passar ao diálogo:

```tsx
const [entryFor, setEntryFor] = useState<Supply | null>(null);
```

O botão da linha passa a abrir:

```tsx
<Button variant="ghost" size="sm" onClick={() => setEntryFor(supply)}>
  Entrada
</Button>
```

E, ao fim da `<section>`, antes de fechar:

```tsx
<StockEntryDialog supply={entryFor} onOpenChange={(open) => !open && setEntryFor(null)} />
```

Com os imports de `useState`, `Supply` e `StockEntryDialog`.

- [ ] **Step 6: Extend the balances list test**

Acrescentar em `src/features/stock/StockListPage.test.tsx`, dentro do `describe`:

```tsx
test("the entry button opens the dialog for that supply", async () => {
  renderList(["STOCK_READ", "STOCK_WRITE"]);

  const row = (await screen.findByText("Farinha de trigo")).closest("tr")!;
  await userEvent.click(within(row).getByRole("button", { name: /entrada/i }));

  expect(await screen.findByRole("dialog")).toHaveTextContent("Farinha de trigo");
});
```

Acrescentando `import userEvent from "@testing-library/user-event";` e `within` ao import de
`@testing-library/react`. Não é preciso montar `<Toaster />` aqui: este teste não observa toast nenhum.

- [ ] **Step 7: Run the two suites**

Run: `npx vitest run src/features/stock`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
npm run lint:prettier:fix
git add src/components/ui/dialog.tsx src/features/stock
git commit -m "feat(stock): record a stock entry from the balances list"
```

---

### Task 9: O razão de movimentações

A leitura paginada por cursor, com botão explícito de carregar mais.

**Files:**

- Create: `src/features/stock/StockLedgerPage.tsx`
- Test: `src/features/stock/StockLedgerPage.test.tsx`
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**

- Consumes: `useMovements`, `MOVEMENT_TYPE_LABELS` da Task 6; `useSupply` da Task 3; `formatInUnit` da Task 2
- Produces: `formatDate(iso: string): string` em `@/lib/format`; `StockLedgerPage`

- [ ] **Step 1: Write the failing test**

Acrescentar em `src/lib/format.test.ts`:

```ts
describe("formatDate", () => {
  test("prints the Brazilian short date", () => {
    expect(formatDate("2026-08-16T12:00:00.000Z")).toBe("16/08/2026");
  });
});
```

Acrescentando `formatDate` ao import de `@/lib/format`.

`src/features/stock/StockLedgerPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { StockLedgerPage } from "@/features/stock/StockLedgerPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";
const SUPPLY_ID = "33333333-3333-4333-8333-333333333333";

const supply = {
  id: SUPPLY_ID,
  name: "Farinha de trigo",
  type: "INGREDIENT",
  purchaseUnit: "KG",
  purchaseQty: 5,
  purchasePrice: 24,
  currentStock: 12500,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

const entry = {
  id: "44444444-4444-4444-8444-444444444444",
  supplyId: SUPPLY_ID,
  type: "ENTRY",
  quantityBase: 5000,
  reason: null,
  note: "Nota 123",
  productionId: null,
  createdAt: "2026-08-16T12:00:00.000Z",
};

const consumption = {
  ...entry,
  id: "66666666-6666-4666-8666-666666666666",
  type: "PRODUCTION",
  quantityBase: -1200,
  note: null,
  createdAt: "2026-08-15T12:00:00.000Z",
};

/**
 * `supplyMissing` is a parameter rather than a `server.use` override in the
 * test body: `server.use` prepends, so a handler registered before this helper
 * runs would be shadowed by the one this helper registers for the same route.
 */
function renderLedger(supplyMissing = false) {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["STOCK_READ"],
      }),
    ),
    msw.get(`${API}/supplies/${SUPPLY_ID}`, () =>
      supplyMissing
        ? HttpResponse.json({ message: "Insumo não encontrado" }, { status: 404 })
        : HttpResponse.json(supply),
    ),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/stock/:id" element={<StockLedgerPage />} />
      <Route path="/stock" element={<p>lista de saldos</p>} />
    </Routes>,
    { route: `/stock/${SUPPLY_ID}` },
  );
}

beforeEach(() => {
  clearSession();
});

describe("StockLedgerPage", () => {
  test("shows the type in Portuguese and the quantity signed, in the purchase unit", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () =>
        HttpResponse.json({ data: [entry, consumption], nextCursor: null }),
      ),
    );
    renderLedger();

    const entryRow = (await screen.findByText("Entrada")).closest("tr")!;
    const consumptionRow = screen.getByText("Produção").closest("tr")!;

    expect(entryRow).toHaveTextContent("+5 kg");
    expect(entryRow).toHaveTextContent("16/08/2026");
    expect(consumptionRow).toHaveTextContent("-1,2 kg");
  });

  test("shows the supply's name and current balance in the header", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () => HttpResponse.json({ data: [entry], nextCursor: null })),
    );
    renderLedger();

    expect(await screen.findByRole("heading", { name: /farinha de trigo/i })).toBeInTheDocument();
    expect(screen.getByText(/12,5 kg/)).toBeInTheDocument();
  });

  test("loads the next page with the cursor it was given", async () => {
    const cursors: (string | null)[] = [];
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return cursor
          ? HttpResponse.json({ data: [consumption], nextCursor: null })
          : HttpResponse.json({ data: [entry], nextCursor: entry.id });
      }),
    );
    renderLedger();

    await userEvent.click(await screen.findByRole("button", { name: /carregar mais/i }));

    expect(await screen.findByText("Produção")).toBeInTheDocument();
    expect(cursors).toEqual([null, entry.id]);
  });

  test("hides the button when the API says there is no next page", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () => HttpResponse.json({ data: [entry], nextCursor: null })),
    );
    renderLedger();

    expect(await screen.findByText("Entrada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /carregar mais/i })).not.toBeInTheDocument();
  });

  test("says so when the supply has never moved", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () => HttpResponse.json({ data: [], nextCursor: null })),
    );
    renderLedger();

    expect(await screen.findByText(/nenhuma movimentação registrada/i)).toBeInTheDocument();
  });

  // A stale URL is not an exceptional case, so it lands in the inline error
  // state with a way back, not in a route error boundary.
  test("a 404 offers the name of the problem and a way back", async () => {
    server.use(
      msw.get(`${API}/supplies/${SUPPLY_ID}/movements`, () =>
        HttpResponse.json({ message: "Insumo não encontrado" }, { status: 404 }),
      ),
    );
    renderLedger(true);

    expect(await screen.findByText(/insumo não encontrado/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para estoque/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/format.test.ts src/features/stock/StockLedgerPage.test.tsx`
Expected: FAIL — `formatDate is not a function` e `Failed to resolve import "@/features/stock/StockLedgerPage"`.

- [ ] **Step 3: Write minimal implementation**

Acrescentar em `src/lib/format.ts`:

```ts
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** The API sends ISO timestamps; the ledger reads better as a plain date. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
```

`src/features/stock/StockLedgerPage.tsx`:

```tsx
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOVEMENT_TYPE_LABELS } from "@/features/stock/movement-labels";
import { useMovements } from "@/features/stock/use-movements";
import { useSupply } from "@/features/supplies/use-supply";
import { formatDate } from "@/lib/format";
import { formatInUnit } from "@/lib/unit";

export function StockLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const supply = useSupply(id);
  const movements = useMovements(id);

  const failed = supply.error ?? movements.error;
  if (failed) {
    return (
      <section className="p-8">
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void supply.refetch();
            void movements.refetch();
          }}
        />
        <Link to="/stock" className="mt-4 inline-block text-sm underline">
          Voltar para estoque
        </Link>
      </section>
    );
  }
  if (!supply.data || !movements.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  const rows = movements.data.pages.flatMap((page) => page.data);

  return (
    <section className="p-8">
      <PageHeader title={supply.data.name}>
        <p className="text-sm text-muted-foreground">
          Saldo: {formatInUnit(supply.data.currentStock, supply.data.purchaseUnit)}
        </p>
      </PageHeader>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="tabular-nums">{formatDate(movement.createdAt)}</TableCell>
                  <TableCell>{MOVEMENT_TYPE_LABELS[movement.type]}</TableCell>
                  {/* The sign comes from the stored quantity, not from the type:
                      production and waste are already negative in the ledger. */}
                  <TableCell className="tabular-nums">
                    {movement.quantityBase > 0 ? "+" : ""}
                    {formatInUnit(movement.quantityBase, supply.data.purchaseUnit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{movement.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {movements.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={movements.isFetchingNextPage}
              onClick={() => void movements.fetchNextPage()}
            >
              Carregar mais
            </Button>
          )}
        </>
      )}

      <Link to="/stock" className="mt-6 inline-block text-sm underline">
        Voltar para estoque
      </Link>
    </section>
  );
}
```

Se o `supply.data` der erro de narrowing dentro do `.map`, guarde-o numa constante antes do `return` — não use `!`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/format.test.ts src/features/stock/StockLedgerPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the route**

Em `src/app/router.tsx`, dentro do bloco `STOCK_READ` que a Task 7 criou:

```tsx
children: [
  { path: "/stock", element: <StockListPage /> },
  { path: "/stock/:id", element: <StockLedgerPage /> },
],
```

Com o import `import { StockLedgerPage } from "@/features/stock/StockLedgerPage";`.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
npm run lint:prettier:fix
git add src/features/stock src/lib/format.ts src/lib/format.test.ts src/app/router.tsx
git commit -m "feat(stock): add the paginated movements ledger"
```

---

### Task 10: Portão final

A fatia inteira verificada junto, e a única verificação que teste nenhum faz: a tela no navegador.

**Files:**

- Modify: nenhum, a não ser que algo falhe

**Interfaces:**

- Consumes: tudo
- Produces: nada

- [ ] **Step 1: Typecheck**

Run: `npx tsc -b`
Expected: sem saída, código 0.

- [ ] **Step 2: Suíte inteira**

Run: `npm test`
Expected: todos os arquivos passando. A fatia acrescenta cerca de 8 arquivos e 45 testes aos 26 e 156 do início.

- [ ] **Step 3: Formatação**

Run: `npm run lint:prettier:check`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: termina sem erro.

- [ ] **Step 5: Verificação manual no navegador**

Este passo **não é delegado**: quem controla o plano roda e confere. Com o `wa-api` de pé e `npm run dev`:

1. `/supplies` lista os insumos do seed, com preço em real e a compra na unidade certa
2. Criar um insumo em KG, com quantidade 5 e preço 24, volta para a lista com ele lá
3. `/stock` mostra o insumo novo com saldo `0 un`/`0 kg`
4. Lançar entrada de 5 kg: o toast cita `5 kg` e a lista passa a mostrar `5 kg`
5. O select da entrada, num insumo em KG, oferece só `g` e `kg`
6. Clicar no insumo abre o razão com a linha `+5 kg` na data de hoje
7. Tentar excluir esse insumo: aparece a mensagem sobre movimentação ou receita, e a linha continua
8. Criar outro insumo e excluí-lo sem movimentar: some da lista
9. Entrar com um usuário sem `STOCK_WRITE`: o botão de entrada não aparece em `/stock`
10. Digitar `/supplies/new` com um usuário sem `SUPPLIES_WRITE`: tela de acesso negado

- [ ] **Step 6: Commit, se algo mudou**

Se os passos acima exigiram conserto:

```bash
npm run lint:prettier:fix
git add -A
git commit -m "fix(stock): <o que o portão final encontrou>"
```

Se nada mudou, não há commit — o portão passou.

---

## Autoverificação do plano

**Cobertura da spec.** Cada seção da spec tem tarefa: os tipos defasados na Task 1; o módulo de unidade na Task 2; o
cadastro nas Tasks 3, 4 e 5; a operação nas Tasks 6, 7, 8 e 9; o portão final na Task 10. Os 23 testes numerados na spec
aparecem todos: 1–5 na Task 2, 6–7 nas Tasks 4 e 5, 8 na Task 7, 9 nas Tasks 4 e 5, 10–15 nas Tasks 3, 4 e 5, 16–20 nas
Tasks 7 e 8, 21–23 na Task 9.

**Um desvio da spec**, declarado na Task 5: o `select` do shadcn vira `native-select.tsx`, porque o repositório já usa
`<select>` nativo em `UserFormPage` e o nome evita colisão com o que o CLI do shadcn geraria. A spec precisa ser
corrigida nesse ponto.

**Um item da spec fora do plano por decisão:** a spec descreve o comportamento de editar `purchaseUnit` para outra
dimensão como achado do `wa-api`. Nenhuma tarefa o trata, de propósito — ele vira issue no outro repositório.
