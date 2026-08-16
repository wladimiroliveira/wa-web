# Usuários e Papéis — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as telas de administração de usuários e papéis, com edição de permissão efetiva por usuário.

**Architecture:** Quatro telas em rota própria sobre a fundação da fatia 1. O núcleo é uma função pura que traduz "o que
essa pessoa pode fazer" no par `granted`/`denied` que a API espera; a tela nunca expõe o conceito de exceção. Nenhuma
tabela genérica é criada: duas `<table>` explícitas.

**Tech Stack:** React 19, TypeScript, React Router v7, TanStack Query v5, react-hook-form + Zod, Tailwind v4,
shadcn/ui (estilo `base-nova`, primitivas `@base-ui/react`), Vitest, Testing Library, MSW.

**Spec:** [docs/superpowers/specs/2026-08-16-usuarios-papeis-design.md](../specs/2026-08-16-usuarios-papeis-design.md)

## Global Constraints

- **Idioma:** identificadores, arquivos, testes e comentários em inglês. Português só no texto que a pessoa lê na tela.
- **Segmento de URL é identificador:** `/users/new`, nunca `/users/novo`.
- **TDD sem exceção:** teste vermelho primeiro, com a saída da falha colada, antes de qualquer implementação.
- **Commits:** o usuário autorizou, em 2026-08-16, um commit por tarefa no branch `feat/users-roles` e só nele. Nada de
  push, nada de PR, nada na `main`. Cada tarefa termina com a suíte rodada, a saída colada e o commit feito com a
  mensagem escrita no passo final.
- **Prettier:** 120 colunas, aspas duplas, ponto e vírgula, `trailingComma: all`. Rodar `npm run lint:prettier:fix` antes
  de fechar cada tarefa.
- **MSW roda com `onUnhandledRequest: "error"`:** todo endpoint que a tela chama precisa de handler no teste, inclusive
  `GET /me`. Uma requisição não prevista falha o teste.
- **Nenhuma trava de segurança no front end.** Se a API permite, a tela permite. Não inventar bloqueio de autoedição,
  proteção do papel Owner ou recusa de exclusão de papel em uso.
- **API base nos testes:** `http://localhost:3333`, o valor de `VITE_API_URL` em `.env.test`.
- **Tipos vêm de `@/lib/api.types`**, sempre derivados de `paths`. Nenhum contrato redigitado à mão.

---

### Task 1: Rótulos de permissão

Traduz as 13 permissões para português e agrupa por módulo. Ser um `Record` completo é o mecanismo que faz o `tsc`
quebrar quando o contrato crescer.

**Files:**

- Create: `src/features/auth/permission-labels.ts`
- Test: `src/features/auth/permission-labels.test.ts`

**Interfaces:**

- Consumes: `Permission` de `@/features/auth/permission`
- Produces: `PERMISSION_LABELS: Record<Permission, PermissionLabel>`, `ALL_PERMISSIONS: Permission[]`,
  `PERMISSION_GROUPS: PermissionGroup[]`, com
  `interface PermissionLabel { group: string; action: string }` e
  `interface PermissionGroup { group: string; permissions: Permission[] }`

- [ ] **Step 1: Write the failing test**

`src/features/auth/permission-labels.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS } from "@/features/auth/permission-labels";

describe("permission labels", () => {
  test("every permission in the record appears exactly once across the groups", () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);

    expect([...grouped].sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  test("groups keep the record order, so the screen reads module by module", () => {
    expect(PERMISSION_GROUPS.map((group) => group.group)).toEqual([
      "Insumos",
      "Receitas",
      "Precificação",
      "Estoque",
      "Produção",
      "Perdas",
      "Usuários",
    ]);
  });

  test("each permission carries a group and an action in Portuguese", () => {
    expect(PERMISSION_LABELS.SUPPLIES_WRITE).toEqual({ group: "Insumos", action: "Escrever" });
    expect(PERMISSION_LABELS.PRICING_READ).toEqual({ group: "Precificação", action: "Ler" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/permission-labels.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/auth/permission-labels"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/auth/permission-labels.ts`:

```ts
import type { Permission } from "@/features/auth/permission";

export interface PermissionLabel {
  group: string;
  action: string;
}

export interface PermissionGroup {
  group: string;
  permissions: Permission[];
}

/**
 * Exhaustive on purpose. When the API adds a permission, `Record` makes tsc
 * fail here until someone writes the Portuguese label — a new contract never
 * reaches the screen unnoticed.
 */
export const PERMISSION_LABELS: Record<Permission, PermissionLabel> = {
  SUPPLIES_READ: { group: "Insumos", action: "Ler" },
  SUPPLIES_WRITE: { group: "Insumos", action: "Escrever" },
  RECIPES_READ: { group: "Receitas", action: "Ler" },
  RECIPES_WRITE: { group: "Receitas", action: "Escrever" },
  PRICING_READ: { group: "Precificação", action: "Ler" },
  STOCK_READ: { group: "Estoque", action: "Ler" },
  STOCK_WRITE: { group: "Estoque", action: "Escrever" },
  PRODUCTION_READ: { group: "Produção", action: "Ler" },
  PRODUCTION_WRITE: { group: "Produção", action: "Escrever" },
  WASTE_READ: { group: "Perdas", action: "Ler" },
  WASTE_WRITE: { group: "Perdas", action: "Escrever" },
  USERS_READ: { group: "Usuários", action: "Ler" },
  USERS_WRITE: { group: "Usuários", action: "Escrever" },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

/** Derived from the record, so a permission cannot exist in one and be missing from the other. */
export const PERMISSION_GROUPS: PermissionGroup[] = ALL_PERMISSIONS.reduce<PermissionGroup[]>((groups, permission) => {
  const { group } = PERMISSION_LABELS[permission];
  const existing = groups.find((candidate) => candidate.group === group);

  if (existing) existing.permissions.push(permission);
  else groups.push({ group, permissions: [permission] });

  return groups;
}, []);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/permission-labels.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Commit só com ordem explícita — mensagem: `feat(auth): add Portuguese permission labels grouped by module`

---

### Task 2: Derivação das exceções

O núcleo da fatia. Função pura, sem React, que traduz o conjunto marcado no par que a API espera.

**Files:**

- Create: `src/features/auth/permission-diff.ts`
- Test: `src/features/auth/permission-diff.test.ts`

**Interfaces:**

- Consumes: `Permission` de `@/features/auth/permission`
- Produces:
  - `toExceptions(desired: readonly Permission[], rolePermissions: readonly Permission[]): PermissionExceptions`
  - `originOf(permission: Permission, desired: readonly Permission[], rolePermissions: readonly Permission[]): PermissionOrigin`
  - `interface PermissionExceptions { grantedPermissions: Permission[]; deniedPermissions: Permission[] }`
  - `type PermissionOrigin = "role" | "granted" | "denied" | "none"`

- [ ] **Step 1: Write the failing test**

`src/features/auth/permission-diff.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { Permission } from "@/features/auth/permission";
import { originOf, toExceptions } from "@/features/auth/permission-diff";

/** Mirrors the API rule: effective = (role ∪ granted) − denied. Denial always wins. */
function effectivePermissions(role: Permission[], granted: Permission[], denied: Permission[]): Permission[] {
  const effective = new Set<Permission>([...role, ...granted]);
  for (const permission of denied) effective.delete(permission);
  return [...effective].sort();
}

const ESTOQUISTA: Permission[] = ["STOCK_READ", "STOCK_WRITE", "SUPPLIES_READ"];

describe("toExceptions", () => {
  test("round-trips: what the API computes from the exceptions is what the screen had checked", () => {
    const desired: Permission[] = ["STOCK_READ", "SUPPLIES_READ", "SUPPLIES_WRITE"];

    const { grantedPermissions, deniedPermissions } = toExceptions(desired, ESTOQUISTA);

    expect(effectivePermissions(ESTOQUISTA, grantedPermissions, deniedPermissions)).toEqual([...desired].sort());
  });

  test("round-trips with no role at all", () => {
    const desired: Permission[] = ["USERS_READ", "USERS_WRITE"];

    const { grantedPermissions, deniedPermissions } = toExceptions(desired, []);

    expect(grantedPermissions.sort()).toEqual([...desired].sort());
    expect(deniedPermissions).toEqual([]);
    expect(effectivePermissions([], grantedPermissions, deniedPermissions)).toEqual([...desired].sort());
  });

  test("round-trips when nothing is checked: the whole role is denied", () => {
    const { grantedPermissions, deniedPermissions } = toExceptions([], ESTOQUISTA);

    expect(grantedPermissions).toEqual([]);
    expect([...deniedPermissions].sort()).toEqual([...ESTOQUISTA].sort());
    expect(effectivePermissions(ESTOQUISTA, grantedPermissions, deniedPermissions)).toEqual([]);
  });

  test("drops a redundant grant: what the role already gives is not an exception", () => {
    const { grantedPermissions } = toExceptions(ESTOQUISTA, ESTOQUISTA);

    expect(grantedPermissions).toEqual([]);
  });
});

describe("originOf", () => {
  test("classifies each permission by where the check came from", () => {
    const desired: Permission[] = ["STOCK_READ", "SUPPLIES_WRITE"];

    expect(originOf("STOCK_READ", desired, ESTOQUISTA)).toBe("role");
    expect(originOf("SUPPLIES_WRITE", desired, ESTOQUISTA)).toBe("granted");
    expect(originOf("STOCK_WRITE", desired, ESTOQUISTA)).toBe("denied");
    expect(originOf("WASTE_READ", desired, ESTOQUISTA)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/permission-diff.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/auth/permission-diff"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/auth/permission-diff.ts`:

```ts
import type { Permission } from "@/features/auth/permission";

export interface PermissionExceptions {
  grantedPermissions: Permission[];
  deniedPermissions: Permission[];
}

export type PermissionOrigin = "role" | "granted" | "denied" | "none";

/**
 * The screen edits the result — what this person may do — and this turns it
 * into the pair the API stores. The API computes `(role ∪ granted) − denied`,
 * so `granted = desired − role` and `denied = role − desired` round-trip
 * exactly, and a grant the role already covers is dropped instead of stored.
 */
export function toExceptions(
  desired: readonly Permission[],
  rolePermissions: readonly Permission[],
): PermissionExceptions {
  const role = new Set(rolePermissions);
  const wanted = new Set(desired);

  return {
    grantedPermissions: [...wanted].filter((permission) => !role.has(permission)),
    deniedPermissions: [...role].filter((permission) => !wanted.has(permission)),
  };
}

/** Where a checkbox's state comes from, for the annotation beside each row. */
export function originOf(
  permission: Permission,
  desired: readonly Permission[],
  rolePermissions: readonly Permission[],
): PermissionOrigin {
  const inRole = rolePermissions.includes(permission);
  const isChecked = desired.includes(permission);

  if (isChecked) return inRole ? "role" : "granted";
  return inRole ? "denied" : "none";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/permission-diff.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(auth): derive permission exceptions from the desired set`

---

### Task 3: Primitivas de UI e componentes compartilhados

Instala as primitivas do shadcn que faltam e cria as quatro peças que as telas repetem.

Decisão registrada: o seletor de papel será um `<select>` nativo, não a primitiva `select` do shadcn. Motivo — é o único
controle da fatia que precisa funcionar bem em teste de jsdom, e um popover de `@base-ui/react` torna o teste frágil sem
ganho para uma lista curta de papéis.

**Files:**

- Create: `src/components/common/PageHeader.tsx`
- Create: `src/components/common/QueryErrorState.tsx`
- Create: `src/components/common/ConfirmDialog.tsx`
- Create: `src/components/common/RouteError.tsx`
- Create (via CLI): `src/components/ui/table.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/alert-dialog.tsx`,
  `src/components/ui/badge.tsx`
- Test: `src/components/common/QueryErrorState.test.tsx`

**Interfaces:**

- Consumes: `ApiError` de `@/lib/http`, `Button` de `@/components/ui/button`
- Produces:
  - `PageHeader({ title, children }: { title: string; children?: ReactNode })`
  - `QueryErrorState({ error, onRetry }: { error: unknown; onRetry: () => void })`
  - `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps)`
  - `RouteError()` — sem props, usado como `errorElement`

- [ ] **Step 1: Install the shadcn primitives**

Run: `npx shadcn@latest add table checkbox alert-dialog badge`
Expected: quatro arquivos novos em `src/components/ui/`. Não editar o conteúdo gerado.

- [ ] **Step 2: Write the failing test**

`src/components/common/QueryErrorState.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/common/QueryErrorState.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/common/QueryErrorState"`.

- [ ] **Step 4: Write the four components**

`src/components/common/QueryErrorState.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";

interface QueryErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * The recoverable failure — API down, network gone, 500 — rendered where the
 * retry can actually work. A route `errorElement` cannot offer this: React
 * Router has no way to reset its error boundary without navigating.
 */
export function QueryErrorState({ error, onRetry }: QueryErrorStateProps) {
  const message = error instanceof ApiError ? error.message : "Não foi possível carregar. Verifique sua conexão.";

  return (
    <div role="alert" className="rounded-lg border border-destructive/40 p-6">
      <p className="text-sm">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
```

`src/components/common/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </header>
  );
}
```

`src/components/common/ConfirmDialog.tsx`:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Se a API gerada pelo shadcn para `alert-dialog` divergir desses nomes, siga o arquivo gerado e ajuste os imports — não
reescreva o componente gerado.

`src/components/common/RouteError.tsx`:

```tsx
import { Link, useRouteError } from "react-router-dom";
import { ApiError } from "@/lib/http";

/**
 * Last resort for anything thrown during render. Query failures do not land
 * here — they are rendered inline by {@link QueryErrorState}, which is where a
 * retry button can still do something.
 */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof ApiError ? error.message : "Algo deu errado nesta tela.";

  return (
    <section className="p-8">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Voltar para o início
      </Link>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/common/QueryErrorState.test.tsx`
Expected: PASS, 3 testes.

- [ ] **Step 6: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(ui): add the shared page header, error state, confirm dialog and route error`

---

### Task 4: Camada de dados de papéis

**Files:**

- Create: `src/features/roles/roles.api.ts`
- Create: `src/features/roles/use-roles.ts`
- Create: `src/features/roles/use-role-mutations.ts`
- Test: `src/features/roles/roles.api.test.ts`

**Interfaces:**

- Consumes: `request` de `@/lib/http`, `SESSION_QUERY_KEY` de `@/features/auth/use-session`
- Produces:
  - `type Role`, `type CreateRoleInput`, `type UpdateRoleInput`
  - `fetchRoles(): Promise<Role[]>`, `createRole(input): Promise<Role>`,
    `updateRole(id: string, input): Promise<Role>`, `deleteRole(id: string): Promise<void>`
  - `ROLES_QUERY_KEY = ["roles"]`, `USERS_QUERY_KEY = ["users"]`
  - `useRoles()`, `useCreateRole()`, `useUpdateRole()`, `useDeleteRole()`
  - `useInvalidateAdminData()` — invalida `["users"]`, `["roles"]` e `["me"]`

Não existe `GET /roles/:id`. A tela de edição encontra o papel dentro da lista.

- [ ] **Step 1: Write the failing test**

`src/features/roles/roles.api.test.ts`:

```ts
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createRole, deleteRole, fetchRoles, updateRole } from "@/features/roles/roles.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const role = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Estoquista",
  permissions: ["STOCK_READ", "STOCK_WRITE"],
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("roles.api", () => {
  test("lists roles", async () => {
    server.use(msw.get(`${API}/roles`, () => HttpResponse.json([role])));

    await expect(fetchRoles()).resolves.toEqual([role]);
  });

  test("creates a role with its permissions", async () => {
    let received: unknown;
    server.use(
      msw.post(`${API}/roles`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(role, { status: 201 });
      }),
    );

    await createRole({ name: "Estoquista", permissions: ["STOCK_READ", "STOCK_WRITE"] });

    expect(received).toEqual({ name: "Estoquista", permissions: ["STOCK_READ", "STOCK_WRITE"] });
  });

  test("updates a role", async () => {
    server.use(msw.patch(`${API}/roles/${role.id}`, () => HttpResponse.json({ ...role, name: "Estoque" })));

    await expect(updateRole(role.id, { name: "Estoque" })).resolves.toMatchObject({ name: "Estoque" });
  });

  test("deletes a role and tolerates the empty 204 body", async () => {
    server.use(msw.delete(`${API}/roles/${role.id}`, () => new HttpResponse(null, { status: 204 })));

    await expect(deleteRole(role.id)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/roles/roles.api.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/roles/roles.api"`.

- [ ] **Step 3: Write the API module**

`src/features/roles/roles.api.ts`:

```ts
import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type Role = paths["/roles"]["get"]["responses"][200]["content"]["application/json"][number];
export type CreateRoleInput = paths["/roles"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateRoleInput = paths["/roles/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function fetchRoles(): Promise<Role[]> {
  return request<Role[]>("/roles");
}

export function createRole(input: CreateRoleInput): Promise<Role> {
  return request<Role>("/roles", { method: "POST", body: JSON.stringify(input) });
}

export function updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
  return request<Role>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRole(id: string): Promise<void> {
  return request<void>(`/roles/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/roles/roles.api.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Write the query and mutation hooks**

`src/features/roles/use-roles.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchRoles, type Role } from "@/features/roles/roles.api";

export const ROLES_QUERY_KEY = ["roles"] as const;

export function useRoles() {
  return useQuery<Role[]>({ queryKey: ROLES_QUERY_KEY, queryFn: fetchRoles });
}
```

`src/features/roles/use-role-mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/features/auth/use-session";
import {
  createRole,
  deleteRole,
  updateRole,
  type CreateRoleInput,
  type Role,
  type UpdateRoleInput,
} from "@/features/roles/roles.api";
import { ROLES_QUERY_KEY } from "@/features/roles/use-roles";
import { USERS_QUERY_KEY } from "@/features/users/use-users";

/**
 * Coarse on purpose. Editing yourself is the case that forces it: without
 * refetching `me`, the sidebar and the route gates keep deciding by the old
 * permissions and the interface starts lying about what you may do. The cost
 * avoided would be three short, unpaginated GETs.
 */
export function useInvalidateAdminData() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateAdminData();

  return useMutation<Role, unknown, CreateRoleInput>({ mutationFn: createRole, onSuccess: invalidate });
}

export function useUpdateRole(id: string) {
  const invalidate = useInvalidateAdminData();

  return useMutation<Role, unknown, UpdateRoleInput>({
    mutationFn: (input) => updateRole(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateAdminData();

  return useMutation<void, unknown, string>({ mutationFn: deleteRole, onSuccess: invalidate });
}
```

`USERS_QUERY_KEY` ainda não existe — a Task 5 o cria. Rodar o typecheck só ao fim da Task 5.

- [ ] **Step 6: Report**

Run: `npm run lint:prettier:fix && npx vitest run src/features/roles`
Cole a saída. Mensagem: `feat(roles): add the roles API module and query hooks`

---

### Task 5: Camada de dados de usuários

**Files:**

- Create: `src/features/users/users.api.ts`
- Create: `src/features/users/use-users.ts`
- Create: `src/features/users/use-user.ts`
- Create: `src/features/users/use-user-mutations.ts`
- Test: `src/features/users/users.api.test.ts`

**Interfaces:**

- Consumes: `request` de `@/lib/http`, `useInvalidateAdminData` de `@/features/roles/use-role-mutations`
- Produces:
  - `type User`, `type CreateUserInput`, `type UpdateUserInput`
  - `fetchUsers()`, `fetchUser(id)`, `fetchUserPermissions(id): Promise<Permission[]>`, `createUser(input)`,
    `updateUser(id, input)`
  - `USERS_QUERY_KEY = ["users"]`, `userQueryKey(id)`, `userPermissionsQueryKey(id)`
  - `useUsers()`, `useUser(id)`, `useUserPermissions(id)`, `useCreateUser()`, `useUpdateUser(id)`

- [ ] **Step 1: Write the failing test**

`src/features/users/users.api.test.ts`:

```ts
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { createUser, fetchUser, fetchUserPermissions, fetchUsers, updateUser } from "@/features/users/users.api";
import { clearSession, setAccessToken } from "@/lib/tokens";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const user = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Maria Souza",
  username: "maria",
  email: "maria@example.com",
  roleId: "22222222-2222-4222-8222-222222222222",
  grantedPermissions: ["SUPPLIES_WRITE"],
  deniedPermissions: [],
  isActive: true,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

beforeEach(() => {
  clearSession();
  setAccessToken("access-1");
});

describe("users.api", () => {
  test("lists users", async () => {
    server.use(msw.get(`${API}/users`, () => HttpResponse.json([user])));

    await expect(fetchUsers()).resolves.toEqual([user]);
  });

  test("reads a single user", async () => {
    server.use(msw.get(`${API}/users/${user.id}`, () => HttpResponse.json(user)));

    await expect(fetchUser(user.id)).resolves.toEqual(user);
  });

  test("reads the effective permissions the API computed", async () => {
    server.use(
      msw.get(`${API}/users/${user.id}/permissions`, () =>
        HttpResponse.json({ userId: user.id, permissions: ["STOCK_READ", "SUPPLIES_WRITE"] }),
      ),
    );

    await expect(fetchUserPermissions(user.id)).resolves.toEqual(["STOCK_READ", "SUPPLIES_WRITE"]);
  });

  test("creates a user with the password the API only accepts on creation", async () => {
    let received: unknown;
    server.use(
      msw.post(`${API}/users`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(user, { status: 201 });
      }),
    );

    await createUser({
      name: "Maria Souza",
      username: "maria",
      email: "maria@example.com",
      password: "segredo123",
      roleId: null,
      grantedPermissions: [],
      deniedPermissions: [],
    });

    expect(received).toMatchObject({ username: "maria", password: "segredo123" });
  });

  test("updates a user", async () => {
    server.use(msw.patch(`${API}/users/${user.id}`, () => HttpResponse.json({ ...user, isActive: false })));

    await expect(updateUser(user.id, { isActive: false })).resolves.toMatchObject({ isActive: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/users/users.api.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/users/users.api"`.

- [ ] **Step 3: Write the API module**

`src/features/users/users.api.ts`:

```ts
import type { Permission } from "@/features/auth/permission";
import type { paths } from "@/lib/api.types";
import { request } from "@/lib/http";

export type User = paths["/users/{id}"]["get"]["responses"][200]["content"]["application/json"];
export type CreateUserInput = paths["/users"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateUserInput = paths["/users/{id}"]["patch"]["requestBody"]["content"]["application/json"];

type UserPermissionsResponse =
  paths["/users/{id}/permissions"]["get"]["responses"][200]["content"]["application/json"];

export function fetchUsers(): Promise<User[]> {
  return request<User[]>("/users");
}

export function fetchUser(id: string): Promise<User> {
  return request<User>(`/users/${id}`);
}

/**
 * The effective set, computed by the API. The form opens from this instead of
 * a client-side sum, so the front end never re-implements the precedence rule.
 */
export async function fetchUserPermissions(id: string): Promise<Permission[]> {
  const response = await request<UserPermissionsResponse>(`/users/${id}/permissions`);
  return response.permissions;
}

export function createUser(input: CreateUserInput): Promise<User> {
  return request<User>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/users/users.api.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Write the hooks**

`src/features/users/use-users.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchUsers, type User } from "@/features/users/users.api";

export const USERS_QUERY_KEY = ["users"] as const;

export function useUsers() {
  return useQuery<User[]>({ queryKey: USERS_QUERY_KEY, queryFn: fetchUsers });
}
```

`src/features/users/use-user.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import type { Permission } from "@/features/auth/permission";
import { fetchUser, fetchUserPermissions, type User } from "@/features/users/users.api";

export function userQueryKey(id: string) {
  return ["users", id] as const;
}

export function userPermissionsQueryKey(id: string) {
  return ["users", id, "permissions"] as const;
}

export function useUser(id: string | undefined) {
  return useQuery<User>({ queryKey: userQueryKey(id ?? ""), queryFn: () => fetchUser(id!), enabled: Boolean(id) });
}

export function useUserPermissions(id: string | undefined) {
  return useQuery<Permission[]>({
    queryKey: userPermissionsQueryKey(id ?? ""),
    queryFn: () => fetchUserPermissions(id!),
    enabled: Boolean(id),
  });
}
```

`src/features/users/use-user-mutations.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { useInvalidateAdminData } from "@/features/roles/use-role-mutations";
import { createUser, updateUser, type CreateUserInput, type UpdateUserInput, type User } from "@/features/users/users.api";

export function useCreateUser() {
  const invalidate = useInvalidateAdminData();

  return useMutation<User, unknown, CreateUserInput>({ mutationFn: createUser, onSuccess: invalidate });
}

export function useUpdateUser(id: string) {
  const invalidate = useInvalidateAdminData();

  return useMutation<User, unknown, UpdateUserInput>({
    mutationFn: (input) => updateUser(id, input),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 6: Report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit && npx vitest run src/features/users src/features/roles`
Expected: typecheck limpo agora que `USERS_QUERY_KEY` existe.
Cole a saída. Mensagem: `feat(users): add the users API module and query hooks`

---

### Task 6: O seletor de permissões

**Files:**

- Create: `src/features/auth/PermissionPicker.tsx`
- Test: `src/features/auth/PermissionPicker.test.tsx`

**Interfaces:**

- Consumes: `PERMISSION_GROUPS`, `PERMISSION_LABELS` da Task 1; `originOf` da Task 2; `Checkbox` e `Badge` da Task 3
- Produces:
  `PermissionPicker({ value, onChange, rolePermissions }: { value: Permission[]; onChange: (next: Permission[]) => void; rolePermissions?: Permission[] })`

Nome acessível de cada caixa é `"<Grupo> — <Ação>"`, via `aria-label`. Sem isso, "Ler" apareceria sete vezes e nenhum
teste conseguiria apontar para uma linha específica.

- [ ] **Step 1: Write the failing test**

`src/features/auth/PermissionPicker.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { renderWithProviders } from "@/tests/render";

function Harness({ initial, rolePermissions }: { initial: Permission[]; rolePermissions?: Permission[] }) {
  const [value, setValue] = useState<Permission[]>(initial);

  return (
    <>
      <PermissionPicker value={value} onChange={setValue} rolePermissions={rolePermissions} />
      <p data-testid="value">{[...value].sort().join(",")}</p>
    </>
  );
}

describe("PermissionPicker", () => {
  test("renders one checkbox per permission, grouped by module", () => {
    renderWithProviders(<Harness initial={[]} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(13);
    expect(screen.getByRole("checkbox", { name: "Insumos — Escrever" })).not.toBeChecked();
  });

  test("checking a permission adds it to the value", async () => {
    renderWithProviders(<Harness initial={[]} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Ler" }));

    expect(screen.getByTestId("value")).toHaveTextContent("STOCK_READ");
  });

  test("unchecking removes it", async () => {
    renderWithProviders(<Harness initial={["STOCK_READ"]} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Ler" }));

    expect(screen.getByTestId("value")).toHaveTextContent("");
  });

  test("annotates where each check comes from when a role is given", () => {
    renderWithProviders(<Harness initial={["STOCK_READ", "SUPPLIES_WRITE"]} rolePermissions={["STOCK_READ", "STOCK_WRITE"]} />);

    expect(screen.getByTestId("origin-STOCK_READ")).toHaveTextContent("do papel");
    expect(screen.getByTestId("origin-SUPPLIES_WRITE")).toHaveTextContent("+");
    expect(screen.getByTestId("origin-STOCK_WRITE")).toHaveTextContent("−");
    expect(screen.queryByTestId("origin-WASTE_READ")).not.toBeInTheDocument();
  });

  test("shows no annotation at all without a role", () => {
    renderWithProviders(<Harness initial={["STOCK_READ"]} />);

    expect(screen.queryByTestId("origin-STOCK_READ")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/PermissionPicker.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/auth/PermissionPicker"`.

- [ ] **Step 3: Write the component**

`src/features/auth/PermissionPicker.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Permission } from "@/features/auth/permission";
import { originOf, type PermissionOrigin } from "@/features/auth/permission-diff";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/features/auth/permission-labels";

interface PermissionPickerProps {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  /** Given, each row is annotated with where its state came from. */
  rolePermissions?: Permission[];
}

const ORIGIN_LABEL: Record<Exclude<PermissionOrigin, "none">, string> = {
  role: "do papel",
  granted: "+",
  denied: "−",
};

export function PermissionPicker({ value, onChange, rolePermissions }: PermissionPickerProps) {
  function toggle(permission: Permission, checked: boolean) {
    onChange(checked ? [...value, permission] : value.filter((current) => current !== permission));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.group} className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{group.group}</legend>

          {group.permissions.map((permission) => {
            const origin = rolePermissions ? originOf(permission, value, rolePermissions) : "none";

            return (
              <div key={permission} className="flex items-center gap-2 py-1">
                <Checkbox
                  id={permission}
                  aria-label={`${group.group} — ${PERMISSION_LABELS[permission].action}`}
                  checked={value.includes(permission)}
                  onCheckedChange={(checked) => toggle(permission, checked === true)}
                />
                <label htmlFor={permission} className="text-sm">
                  {PERMISSION_LABELS[permission].action}
                </label>

                {origin !== "none" && (
                  <Badge variant="secondary" data-testid={`origin-${permission}`} className="ml-auto">
                    {ORIGIN_LABEL[origin]}
                  </Badge>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
```

Se a primitiva `Checkbox` gerada não expuser `onCheckedChange`, siga a assinatura do arquivo gerado — o contrato deste
componente para fora é `value`/`onChange`, e isso não muda.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/PermissionPicker.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 5: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(auth): add the grouped permission picker`

---

### Task 7: Lista de usuários e a reescrita do router

Primeira tela real. Substitui a geração automática de rotas por rotas declaradas, e cobre a garantia perdida com um
teste.

**Files:**

- Create: `src/features/users/UsersListPage.tsx`
- Create: `src/features/users/UsersListPage.test.tsx`
- Modify: `src/app/router.tsx` (arquivo inteiro)
- Modify: `src/components/layout/nav-items.ts:16` (acrescenta Papéis)
- Create: `src/app/router.test.tsx`

**Interfaces:**

- Consumes: `useUsers` (Task 5), `useRoles` (Task 4), `PageHeader` e `QueryErrorState` (Task 3), `Table*` do shadcn
- Produces: `UsersListPage()`, `routes: RouteObject[]` exportado de `@/app/router`

As telas `UserFormPage`, `RolesListPage` e `RoleFormPage` ainda não existem nas Tasks 8 a 11. Para o router compilar
agora, crie os três arquivos como esqueleto mínimo — `export function RolesListPage() { return null; }` — e substitua
o conteúdo nas tarefas seguintes.

- [ ] **Step 1: Write the failing tests**

`src/app/router.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { HttpResponse, http as msw } from "msw";
import { createMemoryRouter, matchRoutes, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { routes } from "@/app/router";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

beforeEach(() => {
  clearSession();
});

describe("router", () => {
  // The route tree used to be generated from NAV_ITEMS, which made this true by
  // construction. Now that real screens are declared by hand, it needs a test.
  test.each(NAV_ITEMS.map((item) => item.to))("%s resolves to a route", (to) => {
    expect(matchRoutes(routes, to)).not.toBeNull();
  });

  test("the roles screen is reachable from the menu", () => {
    expect(NAV_ITEMS.map((item) => item.to)).toContain("/roles");
  });

  // The write screens are gated by the route, not by hiding a button: typing
  // the address must not be a way in.
  test.each(["/users/new", "/roles/new"])("%s shows the forbidden screen to a read-only user", async (path) => {
    server.use(
      msw.get(`${API}/me`, () =>
        HttpResponse.json({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Leitora",
          username: "leitora",
          email: "leitora@example.com",
          permissions: ["USERS_READ"],
        }),
      ),
      msw.get(`${API}/roles`, () => HttpResponse.json([])),
      msw.get(`${API}/users`, () => HttpResponse.json([])),
    );
    setAccessToken("access-1");
    setRefreshToken("refresh-1");

    // The app's own router, not a stand-in: this asserts the real route tree.
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: /acesso negado/i })).toBeInTheDocument();
  });
});
```

`renderWithProviders` embrulha o filho num `MemoryRouter`. Aninhar `RouterProvider` dentro dele funciona — o provider
interno vence —, mas se o React Router reclamar de roteador aninhado, renderize `<RouterProvider>` direto com
`QueryClientProvider` à mão, sem o helper.

`src/features/users/UsersListPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { UsersListPage } from "@/features/users/UsersListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const roles = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Estoquista",
    permissions: ["STOCK_READ"],
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

const users = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Maria Souza",
    username: "maria",
    email: "maria@example.com",
    roleId: "22222222-2222-4222-8222-222222222222",
    grantedPermissions: [],
    deniedPermissions: [],
    isActive: true,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "João Lima",
    username: "joao",
    email: "joao@example.com",
    roleId: null,
    grantedPermissions: [],
    deniedPermissions: [],
    isActive: false,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

function renderList(permissions: string[], onUsers = () => HttpResponse.json(users)) {
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
    msw.get(`${API}/users`, onUsers),
    msw.get(`${API}/roles`, () => HttpResponse.json(roles)),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/users" element={<UsersListPage />} />
    </Routes>,
    { route: "/users" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("UsersListPage", () => {
  test("shows name, username, role and status", async () => {
    renderList(["USERS_READ", "USERS_WRITE"]);

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    const joao = (await screen.findByText("João Lima")).closest("tr")!;
    expect(joao).toHaveTextContent("joao");
    expect(joao).toHaveTextContent("—");
    expect(joao).toHaveTextContent("Inativo");
    expect((await screen.findByText("Maria Souza")).closest("tr")!).toHaveTextContent("Estoquista");
  });

  test("links each row to the user's screen when the reader may write", async () => {
    renderList(["USERS_READ", "USERS_WRITE"]);

    expect(await screen.findByRole("link", { name: "Maria Souza" })).toHaveAttribute(
      "href",
      "/users/33333333-3333-4333-8333-333333333333",
    );
  });

  test("hides the create button and the row links from a read-only reader", async () => {
    renderList(["USERS_READ"]);

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /novo usuário/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Maria Souza" })).not.toBeInTheDocument();
  });

  test("a failing list offers a retry that actually refetches", async () => {
    let attempts = 0;
    renderList(["USERS_READ"], () => {
      attempts += 1;
      return attempts === 1 ? HttpResponse.json({ message: "Erro interno" }, { status: 500 }) : HttpResponse.json(users);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno");

    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/users/UsersListPage.test.tsx src/app/router.test.tsx`
Expected: FAIL — import de `UsersListPage` não resolve, e `routes` não é exportado de `@/app/router`.

- [ ] **Step 3: Add the menu entry**

`src/components/layout/nav-items.ts`, depois da linha de Usuários:

```ts
  { to: "/roles", label: "Papéis", permission: "USERS_READ" },
```

- [ ] **Step 4: Write the list page**

`src/features/users/UsersListPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { useRoles } from "@/features/roles/use-roles";
import { useUsers } from "@/features/users/use-users";

export function UsersListPage() {
  const users = useUsers();
  const roles = useRoles();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "USERS_WRITE");

  if (users.isError) return <QueryErrorState error={users.error} onRetry={() => void users.refetch()} />;
  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!users.data || !roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  const roleNameById = new Map(roles.data.map((role) => [role.id, role.name]));

  return (
    <section className="p-8">
      <PageHeader title="Usuários">
        {canWrite && (
          <Button asChild size="sm">
            <Link to="/users/new">Novo usuário</Link>
          </Button>
        )}
      </PageHeader>

      {users.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/users/${user.id}`} className="underline-offset-2 hover:underline">
                      {user.name}
                    </Link>
                  ) : (
                    user.name
                  )}
                </TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.roleId ? (roleNameById.get(user.roleId) ?? "—") : "—"}</TableCell>
                <TableCell>{user.isActive ? "Ativo" : "Inativo"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
```

Se a primitiva `Button` não suportar `asChild`, troque por `<Link>` estilizado com as classes do botão.

- [ ] **Step 5: Create the three skeletons and rewrite the router**

`src/features/users/UserFormPage.tsx`, `src/features/roles/RolesListPage.tsx` e `src/features/roles/RoleFormPage.tsx`,
cada um por enquanto:

```tsx
export function UserFormPage() {
  return null;
}
```

`src/app/router.tsx`, arquivo inteiro:

```tsx
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";
import { UnderConstructionPage } from "@/features/placeholder/UnderConstructionPage";
import { RoleFormPage } from "@/features/roles/RoleFormPage";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { UserFormPage } from "@/features/users/UserFormPage";
import { UsersListPage } from "@/features/users/UsersListPage";

/** Menu destinations that already have a real screen. */
const BUILT_ROUTES = new Set(["/users", "/roles"]);

const placeholderItems = NAV_ITEMS.filter((item) => !BUILT_ROUTES.has(item.to));

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      { path: "/", element: <HomePage /> },
      ...placeholderItems.map((item) => ({
        element: <RequirePermission permission={item.permission} />,
        children: [{ path: item.to, element: <UnderConstructionPage title={item.label} /> }],
      })),
      {
        element: <RequirePermission permission="USERS_READ" />,
        errorElement: <RouteError />,
        children: [
          { path: "/users", element: <UsersListPage /> },
          { path: "/roles", element: <RolesListPage /> },
        ],
      },
      {
        element: <RequirePermission permission="USERS_WRITE" />,
        errorElement: <RouteError />,
        children: [
          // Static before dynamic: `/users/new` must not be read as an id.
          { path: "/users/new", element: <UserFormPage /> },
          { path: "/users/:id", element: <UserFormPage /> },
          { path: "/roles/new", element: <RoleFormPage /> },
          { path: "/roles/:id", element: <RoleFormPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/users/UsersListPage.test.tsx src/app/router.test.tsx`
Expected: PASS — 4 na lista, 10 no router (7 itens de menu, o teste de Papéis e os dois de rota guardada).

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: tudo verde, incluindo os testes da fatia 1 que tocam o router e o menu. Se `Sidebar.test.tsx` quebrar por
causa do item novo, corrija o teste — o comportamento novo é intencional.

- [ ] **Step 8: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(users): add the users list and declare module routes explicitly`

---

### Task 8: Criação de usuário

**Files:**

- Modify: `src/features/users/UserFormPage.tsx` (substitui o esqueleto)
- Create: `src/features/users/UserFormPage.test.tsx`

**Interfaces:**

- Consumes: `useCreateUser` (Task 5), `useRoles` (Task 4), `PermissionPicker` (Task 6), `toExceptions` (Task 2),
  `PageHeader` (Task 3)
- Produces: `UserFormPage()` cobrindo criação; a edição entra na Task 9

Estado do formulário: react-hook-form com Zod para os campos de texto, que são os que têm validação. `roleId`,
`isActive` e o conjunto de permissões ficam em `useState`, porque não são campos nativos e não podem ser inválidos.

- [ ] **Step 1: Write the failing test**

`src/features/users/UserFormPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { UserFormPage } from "@/features/users/UserFormPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const roles = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Estoquista",
    permissions: ["STOCK_READ", "STOCK_WRITE"],
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

function renderCreate() {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["USERS_READ", "USERS_WRITE"],
      }),
    ),
    msw.get(`${API}/roles`, () => HttpResponse.json(roles)),
    msw.get(`${API}/users`, () => HttpResponse.json([])),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/users/new" element={<UserFormPage />} />
      <Route path="/users" element={<p>users list</p>} />
    </Routes>,
    { route: "/users/new" },
  );
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText("Nome"), "Maria Souza");
  await userEvent.type(screen.getByLabelText("Usuário"), "Maria");
  await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
}

beforeEach(() => {
  clearSession();
});

describe("UserFormPage — creating", () => {
  test("sends the password and lowercases the username the server would lowercase anyway", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.post(`${API}/users`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "33333333-3333-4333-8333-333333333333" }, { status: 201 });
      }),
    );
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText("users list")).toBeInTheDocument();
    expect(received.username).toBe("maria");
    expect(received.password).toBe("segredo123");
  });

  test("a conflict reports both possible fields, because the API does not say which", async () => {
    server.use(
      msw.post(`${API}/users`, () =>
        HttpResponse.json({ message: "Já existe um registro com esse valor único" }, { status: 409 }),
      ),
    );
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/nome de usuário ou e-mail/i);
    expect(screen.queryByText("users list")).not.toBeInTheDocument();
  });

  test("choosing a role checks exactly what that role grants", async () => {
    renderCreate();
    await screen.findByLabelText("Nome");

    await userEvent.selectOptions(screen.getByLabelText("Papel"), "22222222-2222-4222-8222-222222222222");

    expect(screen.getByRole("checkbox", { name: "Estoque — Ler" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Estoque — Escrever" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Insumos — Ler" })).not.toBeChecked();
  });

  test("sends derived exceptions, never the checked set", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.post(`${API}/users`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "33333333-3333-4333-8333-333333333333" }, { status: 201 });
      }),
    );
    renderCreate();
    await screen.findByLabelText("Nome");

    await fillRequiredFields();
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "22222222-2222-4222-8222-222222222222");
    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Escrever" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Insumos — Escrever" }));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("users list");
    expect(received.roleId).toBe("22222222-2222-4222-8222-222222222222");
    expect(received.grantedPermissions).toEqual(["SUPPLIES_WRITE"]);
    expect(received.deniedPermissions).toEqual(["STOCK_WRITE"]);
  });

  test("rejects a username the API would reject, before spending a round trip", async () => {
    renderCreate();
    await screen.findByLabelText("Nome");

    await userEvent.type(screen.getByLabelText("Nome"), "Maria");
    await userEvent.type(screen.getByLabelText("Usuário"), "ma ria!");
    await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/letras, números, ponto, traço e sublinhado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/users/UserFormPage.test.tsx`
Expected: FAIL — a página é um esqueleto que devolve `null`, então `getByLabelText("Nome")` não encontra nada.

- [ ] **Step 3: Write the form**

`src/features/users/UserFormPage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { toExceptions } from "@/features/auth/permission-diff";
import { useRoles } from "@/features/roles/use-roles";
import { useCreateUser } from "@/features/users/use-user-mutations";
import { ApiError } from "@/lib/http";

const userSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  // Mirrors the API: it lowercases anyway, so doing it here keeps the screen
  // honest about what was saved.
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O usuário tem pelo menos 3 caracteres")
    .max(30, "O usuário tem no máximo 30 caracteres")
    .regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, traço e sublinhado"),
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(8, "A senha tem pelo menos 8 caracteres"),
});

type UserForm = z.infer<typeof userSchema>;

function messageFor(error: unknown): string {
  // The API answers any unique violation with the same sentence and never says
  // which field. On users the clash can be the username or the email, so the
  // screen names both instead of faking a precision the API did not give.
  if (error instanceof ApiError && error.status === 409) {
    return "Já existe um usuário com esse nome de usuário ou e-mail.";
  }
  if (error instanceof ApiError) return error.message;
  return "Não foi possível salvar. Verifique sua conexão.";
}

export function UserFormPage() {
  const navigate = useNavigate();
  const roles = useRoles();
  const createUser = useCreateUser();

  const [roleId, setRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const rolePermissions = roles.data?.find((role) => role.id === roleId)?.permissions ?? [];

  /** Picking a role applies that role: the checks become exactly what it grants. */
  function onRoleChange(nextRoleId: string) {
    setRoleId(nextRoleId);
    setPermissions([...(roles.data?.find((role) => role.id === nextRoleId)?.permissions ?? [])]);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { grantedPermissions, deniedPermissions } = toExceptions(permissions, rolePermissions);

    try {
      await createUser.mutateAsync({
        ...values,
        roleId: roleId || null,
        grantedPermissions,
        deniedPermissions,
      });
      navigate("/users", { replace: true });
    } catch (error) {
      setFormError(messageFor(error));
    }
  });

  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title="Novo usuário" />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />
          <Field id="username" label="Usuário" error={errors.username?.message} {...register("username")} />
          <Field id="email" label="E-mail" type="email" error={errors.email?.message} {...register("email")} />
          <Field
            id="password"
            label="Senha"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="roleId">Papel</Label>
            <select
              id="roleId"
              value={roleId}
              onChange={(event) => onRoleChange(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Sem papel</option>
              {roles.data.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">Permissões deste usuário</h2>
          <PermissionPicker value={permissions} onChange={setPermissions} rolePermissions={rolePermissions} />
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
          <Button variant="ghost" asChild>
            <Link to="/users">Cancelar</Link>
          </Button>
        </div>
      </form>
    </section>
  );
}
```

E o campo, no mesmo arquivo, acima de `UserFormPage`:

```tsx
interface FieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

/**
 * No `forwardRef`: in React 19 `ref` is an ordinary prop, so spreading
 * `register("name")` carries it straight through to the input.
 */
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
```

Acrescente `ComponentProps` ao import de `react`. O `role="alert"` do erro de campo e o do erro de formulário convivem —
o teste do `409` procura o texto, não a contagem de alerts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/users/UserFormPage.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 5: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(users): add the user creation form with the permission picker`

---

### Task 9: Edição de usuário

A mesma página passa a servir os dois modos, decidida pelo `:id` da rota.

**Files:**

- Modify: `src/features/users/UserFormPage.tsx`
- Modify: `src/features/users/UserFormPage.test.tsx` (acrescenta um `describe`)

**Interfaces:**

- Consumes: `useUser`, `useUserPermissions` (Task 5), `useUpdateUser` (Task 5), `useParams` do React Router
- Produces: `UserFormPage()` cobrindo criar e editar

- [ ] **Step 1: Write the failing test**

Acrescente a `src/features/users/UserFormPage.test.tsx`, e amplie o import do topo para
`import { screen, waitFor } from "@testing-library/react";`:

```tsx
const existingUser = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Maria Souza",
  username: "maria",
  email: "maria@example.com",
  roleId: "22222222-2222-4222-8222-222222222222",
  grantedPermissions: ["SUPPLIES_WRITE"],
  deniedPermissions: ["STOCK_WRITE"],
  isActive: true,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
};

function renderEdit() {
  server.use(
    msw.get(`${API}/me`, () =>
      HttpResponse.json({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Owner",
        username: "owner",
        email: "owner@example.com",
        permissions: ["USERS_READ", "USERS_WRITE"],
      }),
    ),
    msw.get(`${API}/roles`, () => HttpResponse.json(roles)),
    msw.get(`${API}/users`, () => HttpResponse.json([existingUser])),
    msw.get(`${API}/users/${existingUser.id}`, () => HttpResponse.json(existingUser)),
    msw.get(`${API}/users/${existingUser.id}/permissions`, () =>
      HttpResponse.json({ userId: existingUser.id, permissions: ["STOCK_READ", "SUPPLIES_WRITE"] }),
    ),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/users/:id" element={<UserFormPage />} />
      <Route path="/users" element={<p>users list</p>} />
    </Routes>,
    { route: `/users/${existingUser.id}` },
  );
}

describe("UserFormPage — editing", () => {
  test("opens with the effective set the API computed", async () => {
    renderEdit();

    expect(await screen.findByRole("checkbox", { name: "Estoque — Ler" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Insumos — Escrever" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Estoque — Escrever" })).not.toBeChecked();
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria Souza");
  });

  test("switching the role replaces the checks with the new role's set", async () => {
    renderEdit();
    await screen.findByRole("checkbox", { name: "Estoque — Ler" });

    await userEvent.selectOptions(screen.getByLabelText("Papel"), "");

    expect(screen.getByRole("checkbox", { name: "Estoque — Ler" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Insumos — Escrever" })).not.toBeChecked();
  });

  test("saves derived exceptions and never the password or the email", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.patch(`${API}/users/${existingUser.id}`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(existingUser);
      }),
    );
    renderEdit();
    await screen.findByRole("checkbox", { name: "Estoque — Ler" });

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("users list");
    expect(received.grantedPermissions).toEqual(["SUPPLIES_WRITE"]);
    expect(received.deniedPermissions).toEqual(["STOCK_WRITE"]);
    expect(received).not.toHaveProperty("password");
    expect(received).not.toHaveProperty("email");
  });

  test("deactivating is offered, because the API offers it", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.patch(`${API}/users/${existingUser.id}`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...existingUser, isActive: false });
      }),
    );
    renderEdit();
    await screen.findByRole("checkbox", { name: "Usuário ativo" });

    await userEvent.click(screen.getByRole("checkbox", { name: "Usuário ativo" }));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("users list");
    expect(received.isActive).toBe(false);
  });

  test("a missing user shows the failure and a way back, not a blank screen", async () => {
    server.use(
      msw.get(`${API}/users/${existingUser.id}`, () =>
        HttpResponse.json({ message: "Usuário não encontrado" }, { status: 404 }),
      ),
    );
    renderEdit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário não encontrado");
  });

  // Editing yourself is the case that forces the coarse invalidation: without
  // refetching `me`, the sidebar and the route gates keep deciding by the old
  // permissions, and the interface lies about what you may do.
  test("saving refetches the session, so the menu stops showing stale permissions", async () => {
    renderEdit();
    await screen.findByRole("checkbox", { name: "Estoque — Ler" });

    // Registered after renderEdit on purpose: MSW gives precedence to the
    // handler added last, so this one has to come second to count anything.
    let meCalls = 0;
    server.use(
      msw.get(`${API}/me`, () => {
        meCalls += 1;
        return HttpResponse.json({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Owner",
          username: "owner",
          email: "owner@example.com",
          permissions: ["USERS_READ", "USERS_WRITE"],
        });
      }),
      msw.patch(`${API}/users/${existingUser.id}`, () => HttpResponse.json(existingUser)),
    );

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("users list");
    await waitFor(() => expect(meCalls).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/users/UserFormPage.test.tsx`
Expected: FAIL — a página ignora o `:id`, então os campos abrem vazios e o `PATCH` nunca acontece.

- [ ] **Step 3: Extend the page**

Mudanças em `src/features/users/UserFormPage.tsx`:

```tsx
import { Link, useNavigate, useParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser, useUserPermissions } from "@/features/users/use-user";
import { useCreateUser, useUpdateUser } from "@/features/users/use-user-mutations";
```

Dentro do componente, no topo:

```tsx
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const user = useUser(id);
  const userPermissions = useUserPermissions(id);
  const updateUser = useUpdateUser(id ?? "");
  const [isActive, setIsActive] = useState(true);
```

Substitua o `userSchema` da Task 8 pelo par abaixo — a senha só existe na criação, então o schema depende do modo:

```tsx
const baseUserSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O usuário tem pelo menos 3 caracteres")
    .max(30, "O usuário tem no máximo 30 caracteres")
    .regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, traço e sublinhado"),
});

const createUserSchema = baseUserSchema.extend({
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(8, "A senha tem pelo menos 8 caracteres"),
});

type CreateForm = z.infer<typeof createUserSchema>;
type UserForm = Partial<CreateForm> & z.infer<typeof baseUserSchema>;
```

E o `useForm` escolhe o resolver e semeia os valores quando os dados chegam:

```tsx
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(isEditing ? baseUserSchema : createUserSchema),
  });

  // Seeds the form once the API answers. `reset` — not `setValue` — so the
  // fields also stop counting as dirty.
  useEffect(() => {
    if (!isEditing || !user.data || !userPermissions.data || !roles.data) return;
    reset({ name: user.data.name, username: user.data.username });
    setRoleId(user.data.roleId ?? "");
    setPermissions([...userPermissions.data]);
    setIsActive(user.data.isActive);
  }, [isEditing, user.data, userPermissions.data, roles.data, reset]);
```

O envio passa a ramificar:

```tsx
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { grantedPermissions, deniedPermissions } = toExceptions(permissions, rolePermissions);

    try {
      if (isEditing) {
        await updateUser.mutateAsync({
          name: values.name,
          username: values.username,
          roleId: roleId || null,
          grantedPermissions,
          deniedPermissions,
          isActive,
        });
      } else {
        await createUser.mutateAsync({
          name: values.name,
          username: values.username,
          email: values.email!,
          password: values.password!,
          roleId: roleId || null,
          grantedPermissions,
          deniedPermissions,
        });
      }
      navigate("/users", { replace: true });
    } catch (error) {
      setFormError(messageFor(error));
    }
  });
```

Os guardas de carregamento e erro cobrem as três queries:

```tsx
  const failed = roles.error ?? user.error ?? userPermissions.error;
  if (failed) {
    return (
      <section className="p-8">
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void roles.refetch();
            void user.refetch();
            void userPermissions.refetch();
          }}
        />
        <Link to="/users" className="mt-4 inline-block text-sm underline">
          Voltar para usuários
        </Link>
      </section>
    );
  }
  if (!roles.data || (isEditing && (!user.data || !userPermissions.data))) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;
  }
```

O título vira `isEditing ? user.data!.name : "Novo usuário"`, os campos de e-mail e senha só são renderizados quando
`!isEditing`, e a edição ganha a caixa de ativo:

```tsx
        {isEditing && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              aria-label="Usuário ativo"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="isActive">Usuário ativo</Label>
          </div>
        )}
```

Acrescente `useEffect` ao import de `react`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/users/UserFormPage.test.tsx`
Expected: PASS, 11 testes — os 5 de criação continuam verdes.

- [ ] **Step 5: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(users): edit users, their role and their effective permissions`

---

### Task 10: Lista de papéis com exclusão

**Files:**

- Modify: `src/features/roles/RolesListPage.tsx` (substitui o esqueleto)
- Create: `src/features/roles/RolesListPage.test.tsx`

**Interfaces:**

- Consumes: `useRoles` (Task 4), `useDeleteRole` (Task 4), `ConfirmDialog`, `PageHeader`, `QueryErrorState` (Task 3)
- Produces: `RolesListPage()`

- [ ] **Step 1: Write the failing test**

`src/features/roles/RolesListPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const role = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Estoquista",
  permissions: ["STOCK_READ", "STOCK_WRITE"],
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
    msw.get(`${API}/roles`, () => HttpResponse.json([role])),
    msw.get(`${API}/users`, () => HttpResponse.json([])),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/roles" element={<RolesListPage />} />
    </Routes>,
    { route: "/roles" },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RolesListPage", () => {
  test("shows each role and how many permissions it grants", async () => {
    renderList(["USERS_READ", "USERS_WRITE"]);

    const row = (await screen.findByText("Estoquista")).closest("tr")!;
    expect(row).toHaveTextContent("2");
  });

  test("deleting asks first and only calls the API after confirmation", async () => {
    let deleted = false;
    server.use(
      msw.delete(`${API}/roles/${role.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderList(["USERS_READ", "USERS_WRITE"]);

    await userEvent.click(await screen.findByRole("button", { name: /excluir/i }));
    expect(deleted).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir papel$/i }));

    expect(deleted).toBe(true);
  });

  test("hides the destructive actions from a read-only reader", async () => {
    renderList(["USERS_READ"]);

    expect(await screen.findByText("Estoquista")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /novo papel/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/roles/RolesListPage.test.tsx`
Expected: FAIL — a página devolve `null`.

- [ ] **Step 3: Write the page**

`src/features/roles/RolesListPage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { useDeleteRole } from "@/features/roles/use-role-mutations";
import { useRoles } from "@/features/roles/use-roles";

export function RolesListPage() {
  const roles = useRoles();
  const deleteRole = useDeleteRole();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "USERS_WRITE");
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title="Papéis">
        {canWrite && (
          <Button asChild size="sm">
            <Link to="/roles/new">Novo papel</Link>
          </Button>
        )}
      </PageHeader>

      {roles.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum papel cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.data.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/roles/${role.id}`} className="underline-offset-2 hover:underline">
                      {role.name}
                    </Link>
                  ) : (
                    role.name
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{role.permissions.length}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(role.id)}>
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
        title="Excluir papel"
        description="Quem usa este papel fica sem papel, mantendo apenas as permissões dadas na mão. Não dá para desfazer."
        confirmLabel="Excluir papel"
        onConfirm={() => {
          if (pendingId) deleteRole.mutate(pendingId);
          setPendingId(null);
        }}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/roles/RolesListPage.test.tsx`
Expected: PASS, 3 testes.

- [ ] **Step 5: Format, typecheck and report**

Run: `npm run lint:prettier:fix && npx tsc -b --noEmit`
Cole a saída. Mensagem: `feat(roles): add the roles list with confirmed deletion`

---

### Task 11: Formulário de papel

Última tela. Não existe `GET /roles/:id`: a edição acha o papel dentro da lista já carregada.

**Files:**

- Modify: `src/features/roles/RoleFormPage.tsx` (substitui o esqueleto)
- Create: `src/features/roles/RoleFormPage.test.tsx`

**Interfaces:**

- Consumes: `useRoles`, `useCreateRole`, `useUpdateRole` (Task 4), `PermissionPicker` (Task 6)
- Produces: `RoleFormPage()`

- [ ] **Step 1: Write the failing test**

`src/features/roles/RoleFormPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { Route, Routes } from "react-router-dom";
import { RoleFormPage } from "@/features/roles/RoleFormPage";
import { clearSession, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { renderWithProviders } from "@/tests/render";
import { server } from "@/tests/server";

const API = "http://localhost:3333";

const role = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Estoquista",
  permissions: ["STOCK_READ", "STOCK_WRITE"],
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
        permissions: ["USERS_READ", "USERS_WRITE"],
      }),
    ),
    msw.get(`${API}/roles`, () => HttpResponse.json([role])),
    msw.get(`${API}/users`, () => HttpResponse.json([])),
  );
  setAccessToken("access-1");
  setRefreshToken("refresh-1");

  return renderWithProviders(
    <Routes>
      <Route path="/roles/new" element={<RoleFormPage />} />
      <Route path="/roles/:id" element={<RoleFormPage />} />
      <Route path="/roles" element={<p>roles list</p>} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  clearSession();
});

describe("RoleFormPage", () => {
  test("creates a role with the checked permissions", async () => {
    let received: Record<string, unknown> = {};
    server.use(
      msw.post(`${API}/roles`, async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(role, { status: 201 });
      }),
    );
    renderForm("/roles/new");

    await userEvent.type(await screen.findByLabelText("Nome"), "Confeiteiro");
    await userEvent.click(screen.getByRole("checkbox", { name: "Receitas — Ler" }));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText("roles list");
    expect(received).toEqual({ name: "Confeiteiro", permissions: ["RECIPES_READ"] });
  });

  test("a duplicate name is an inline error, because name is the only unique field", async () => {
    server.use(
      msw.post(`${API}/roles`, () =>
        HttpResponse.json({ message: "Já existe um registro com esse valor único" }, { status: 409 }),
      ),
    );
    renderForm("/roles/new");

    await userEvent.type(await screen.findByLabelText("Nome"), "Estoquista");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/já existe um papel com esse nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveAttribute("aria-invalid", "true");
  });

  test("editing opens with the role's own permissions checked", async () => {
    renderForm(`/roles/${role.id}`);

    expect(await screen.findByLabelText("Nome")).toHaveValue("Estoquista");
    expect(screen.getByRole("checkbox", { name: "Estoque — Escrever" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Insumos — Ler" })).not.toBeChecked();
  });

  test("editing shows no origin annotations — a role has no exceptions", async () => {
    renderForm(`/roles/${role.id}`);

    await screen.findByLabelText("Nome");
    expect(screen.queryByTestId("origin-STOCK_READ")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/roles/RoleFormPage.test.tsx`
Expected: FAIL — a página devolve `null`.

- [ ] **Step 3: Write the page**

`src/features/roles/RoleFormPage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { useCreateRole, useUpdateRole } from "@/features/roles/use-role-mutations";
import { useRoles } from "@/features/roles/use-roles";
import { ApiError } from "@/lib/http";

const roleSchema = z.object({ name: z.string().trim().min(1, "Informe o nome do papel") });

type RoleForm = z.infer<typeof roleSchema>;

export function RoleFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const roles = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole(id ?? "");

  const [permissions, setPermissions] = useState<Permission[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoleForm>({ resolver: zodResolver(roleSchema) });

  const role = roles.data?.find((candidate) => candidate.id === id);

  // There is no GET /roles/:id — the list is the only source, so the form seeds
  // itself once the list lands.
  useEffect(() => {
    if (!isEditing || !role) return;
    reset({ name: role.name });
    setPermissions([...role.permissions]);
  }, [isEditing, role, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing) await updateRole.mutateAsync({ name: values.name, permissions });
      else await createRole.mutateAsync({ name: values.name, permissions });
      navigate("/roles", { replace: true });
    } catch (error) {
      // `name` is the only unique column on roles, so a conflict can be pinned
      // to the field — unlike users, where it could be the username or the email.
      const message =
        error instanceof ApiError && error.status === 409
          ? "Já existe um papel com esse nome."
          : error instanceof ApiError
            ? error.message
            : "Não foi possível salvar. Verifique sua conexão.";

      setError("name", { message });
    }
  });

  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title={isEditing ? (role?.name ?? "Papel") : "Novo papel"} />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-sm text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">Permissões deste papel</h2>
          <PermissionPicker value={permissions} onChange={setPermissions} />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Salvar
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/roles">Cancelar</Link>
          </Button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/roles/RoleFormPage.test.tsx`
Expected: PASS, 4 testes.

- [ ] **Step 5: Run the whole suite**

Run: `npm test && npx tsc -b --noEmit && npm run lint:prettier:check`
Expected: tudo verde. Cole a saída inteira — é a verificação que fecha a fatia.

- [ ] **Step 6: Report**

Mensagem: `feat(roles): add the role form for creating and editing`

---

## Verificação final da fatia

Depois da Task 11, confira contra o spec, um item por linha:

- [ ] `/users`, `/users/new`, `/users/:id`, `/roles`, `/roles/new`, `/roles/:id` existem e estão guardadas por
      `USERS_READ` ou `USERS_WRITE` conforme a tabela do spec
- [ ] Nenhuma trava de segurança inventada no front end: dá para se desativar, se rebaixar e esvaziar o papel Owner
- [ ] `granted`/`denied` nunca são editados diretamente pela tela
- [ ] Nenhuma `DataTable` genérica foi criada
- [ ] Toda mutação invalida `["users"]`, `["roles"]` e `["me"]`
- [ ] Os 19 comportamentos listados na seção de testes do spec têm teste correspondente

## Depois do código

Abrir no `wa-api` as seis issues da seção "Achados no `wa-api`" do spec — com ordem explícita do usuário, e só depois
que esta fatia estiver fechada.
