# Fundação do front web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação do `wa-web` — projeto, camada HTTP com rotação de sessão serializada, guarda de permissão, casco e design system — e provar que ela funciona com o CRUD de papéis de ponta a ponta.

**Architecture:** SPA React 19 sobre Vite 8, publicada como estático, consumindo o `wa-api` por HTTP. O estado de servidor pertence ao TanStack Query; a sessão guarda o access token em memória e o refresh token em `localStorage`, e a rotação roda sob trava para não disparar a revogação em cadeia do back end. As telas são fatias verticais que não conhecem o interior umas das outras.

**Tech Stack:** React 19.2.8, Vite 8.2.2, TypeScript 6.0.3, TanStack Query 5.102.8, React Router 7.18.3, react-hook-form 7.86.0, Zod 4.5.4, Tailwind 4.3.3, Base UI 1.7.0 no padrão shadcn, Vitest 4.1.11, Testing Library, MSW 2.15.0.

**Spec:** `docs/superpowers/specs/2026-08-29-fundacao-do-front-web-design.md`

## Global Constraints

Valem para toda tarefa deste plano. Nenhuma tarefa pode afrouxá-las.

- **TDD sem exceção.** Teste que falha primeiro, com a saída do vermelho colada no relatório da tarefa, antes de qualquer linha de implementação.
- **Idioma.** Identificadores, arquivos, testes, comentários, mensagens de commit e nomes de branch em inglês. Português apenas no texto que o operador lê na tela.
- **Commits.** Uma linha, formato `type(scope): what the change does`. Sem corpo.
- **Git.** Nunca trabalhar na `main`. Este plano roda na branch `feat/web-foundation`. Não commitar, dar push ou abrir PR sem ordem explícita do dono do projeto — os commits descritos nas tarefas são executados apenas quando ele autorizar.
- **Node 22 (`lts/jod`)**, igual ao `wa-api`.
- **Alias de importação:** `@/` resolve para `src/`. Nenhuma importação relativa que suba diretório (`../`).
- **A mensagem de erro da API nunca vai para a tela.** O `wa-api` responde em inglês; a interface é em português. Cada fatia traduz status mais contexto.
- **O front nunca é autoridade sobre permissão.** `403` é estado previsto, não defeito.
- **Nada de `any`.** `strict` ligado, `noUncheckedIndexedAccess` ligado.
- **Tela pequena é caso previsto.** Todo alvo de toque tem ao menos 44px, e nenhuma tela depende de largura de desktop para ser usável — o chão de fábrica usa tablet. Vale para cada componente e cada tela deste plano, não só para as citadas.
- **Um único repositório é tocado** — o `wa-web` — com uma exceção autorizada e limitada: a Task 2 adiciona ao `wa-api` o script de serialização do OpenAPI e o `openapi.json` versionado. Nada além disso naquele repositório.

## Contrato do `wa-api` consumido nesta fatia

Base: `VITE_API_BASE_URL`, que já inclui o prefixo de versão (ex.: `http://localhost:3333/v1`).

| Rota                          | Permissão exigida | Corpo                              | Respostas                  |
| ----------------------------- | ----------------- | ---------------------------------- | -------------------------- |
| `POST /sessions/signin`       | pública           | `{ username, password }`           | `200` par de tokens, `401` |
| `POST /sessions/refresh`      | pública           | `{ refreshToken }`                 | `200` par de tokens, `401` |
| `POST /sessions/signout`      | autenticado       | `{ refreshToken }`                 | `204`                      |
| `GET /sessions/me`            | autenticado       | —                                  | `200` usuário e permissões |
| `PATCH /sessions/me/password` | autenticado       | `{ currentPassword, newPassword }` | `204`, `401`               |
| `GET /roles`                  | `ACCESS_READ`     | —                                  | `200` lista                |
| `POST /roles`                 | `ACCESS_CREATE`   | `{ name, permissions }`            | `201`, `409` nome repetido |
| `PATCH /roles/{id}`           | `ACCESS_UPDATE`   | `{ name?, permissions? }`          | `200`, `404`, `409`        |
| `DELETE /roles/{id}`          | `ACCESS_UPDATE`   | —                                  | `204`, `404`               |

Permissões do enum: `CATALOG_READ`, `CATALOG_CREATE`, `CATALOG_UPDATE`, `ENTRIES_READ`, `ENTRIES_CREATE`, `PRODUCTION_READ`, `PRODUCTION_CREATE`, `SALES_READ`, `SALES_CREATE`, `REPORTS_READ`, `ACCESS_READ`, `ACCESS_CREATE`, `ACCESS_UPDATE`.

## File Structure

| Arquivo                                     | Responsabilidade                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `src/lib/env.ts`                            | Lê e valida o ambiente. Único lugar que toca `import.meta.env`.             |
| `src/lib/api.types.ts`                      | Gerado do OpenAPI. Nunca editado à mão.                                     |
| `src/lib/api.ts`                            | Apelidos nomeados sobre o arquivo gerado. Único lugar que o indexa.         |
| `src/lib/tokens.ts`                         | Onde o par de tokens vive e como é limpo.                                   |
| `src/lib/refresh-lock.ts`                   | Serializa a rotação, entre abas quando o navegador permite.                 |
| `src/lib/http.ts`                           | `ApiError`, cabeçalhos, interceptação de `401`, repetição.                  |
| `src/lib/query.ts`                          | Configuração do cliente de cache: `staleTime`, foco, política de repetição. |
| `src/lib/permissions.ts`                    | Vocabulário de permissões: tipo, verificação e rótulos em português.        |
| `src/lib/form-errors.ts`                    | Traduz `ApiError` para mensagem de formulário.                              |
| `src/lib/utils.ts`                          | `cn`, exigido pelo padrão shadcn.                                           |
| `src/features/auth/auth.api.ts`             | Chamadas de sessão contra o `wa-api`.                                       |
| `src/features/auth/session-context.tsx`     | Estado da sessão e ações de entrar e sair.                                  |
| `src/features/auth/use-session.ts`          | Acesso ao contexto de sessão.                                               |
| `src/features/auth/RequireSession.tsx`      | Porta de autenticação.                                                      |
| `src/features/auth/RequirePermission.tsx`   | Porta de autorização.                                                       |
| `src/features/auth/LoginPage.tsx`           | Tela de entrada.                                                            |
| `src/features/auth/ChangePasswordPage.tsx`  | Troca da própria senha.                                                     |
| `src/features/auth/ForbiddenPage.tsx`       | Acesso negado.                                                              |
| `src/features/roles/roles.api.ts`           | Chamadas e chaves de cache de papéis.                                       |
| `src/features/roles/RolesListPage.tsx`      | Lista, com criação, edição e exclusão.                                      |
| `src/features/roles/RoleDialog.tsx`         | Formulário de papel em diálogo.                                             |
| `src/components/layout/AppShell.tsx`        | Casco: navegação, identificação do usuário, área de conteúdo.               |
| `src/components/layout/nav-items.ts`        | Fonte única do menu.                                                        |
| `src/components/common/QueryErrorState.tsx` | Estado de erro com ação de repetir.                                         |
| `src/components/common/RouteError.tsx`      | Limite de erro por rota.                                                    |
| `src/components/ui/*`                       | Vocabulário visual, gerado pelo shadcn.                                     |
| `src/app/router.tsx`                        | Tabela de rotas e onde cada guarda entra.                                   |
| `src/app/providers.tsx`                     | Composição dos provedores.                                                  |
| `src/tests/setup.ts`                        | Configuração da suíte.                                                      |
| `src/tests/msw-server.ts`                   | Servidor de mocks.                                                          |
| `src/tests/samples.ts`                      | Amostras tipadas pelo contrato, usadas pelos mocks.                         |
| `src/tests/render.tsx`                      | Renderização com provedores, para testes de tela.                           |

---

## Task 1: Esqueleto do projeto e ambiente validado

**Files:**

- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.nvmrc`, `.gitignore`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `commitlint.config.js`, `.example.env`, `.env.test`, `src/main.tsx`, `src/index.css`, `src/app/App.tsx`, `src/tests/setup.ts`
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: `parseEnv(source: Record<string, unknown>): Env` e `env: Env`, onde `Env = { apiUrl: string }`. Todo módulo que precisa da base da API importa `env` de `@/lib/env` e lê `env.apiUrl`, já sem barra no fim.

- [ ] **Step 1: Criar o projeto e instalar as dependências**

```bash
npm init -y
npm pkg set name=wa-web version=0.0.0 type=module
npm pkg set private=true --json
npm pkg delete main

# openapi-typescript declares peer `typescript: "^5.x"` and genuinely breaks on
# TypeScript 7 — its Go rewrite dropped `ts.factory`, which the generator calls.
# TypeScript 6.0.3 is the newest release the generator actually runs on, so the
# peer range is narrowed here for that one package and nowhere else.
npm pkg set 'overrides.openapi-typescript.typescript=$typescript'

npm install react@19.2.8 react-dom@19.2.8 react-router-dom@7.18.3 \
  @tanstack/react-query@5.102.8 react-hook-form@7.86.0 @hookform/resolvers@5.9.1 \
  zod@4.5.4 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 @base-ui/react@1.7.0 \
  class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.6.0 \
  lucide-react@1.37.0 sonner@2.0.8 @fontsource-variable/geist@5.3.0

npm install -D typescript@6.0.3 vite@8.2.2 @vitejs/plugin-react@6.1.1 \
  @types/react@19.2.18 @types/react-dom@19.2.5 @types/node@26.4.0 \
  vitest@4.1.11 jsdom@30.0.1 @testing-library/react@16.3.3 \
  @testing-library/user-event@14.6.6 @testing-library/jest-dom@7.0.1 \
  msw@2.15.0 openapi-typescript@7.13.0 prettier@3.9.6 husky@9.1.7 \
  @commitlint/cli@21.2.2 @commitlint/config-conventional@21.2.2
```

- [ ] **Step 2: Escrever os arquivos de configuração**

`.nvmrc`:

```
lts/jod
```

`.gitignore`:

```
node_modules
dist
.env
.env.local
*.local
```

`.prettierrc`:

```json
{ "printWidth": 120, "semi": true, "trailingComma": "all" }
```

`.prettierignore` — `docs` entra porque o gancho de pre-commit roda `prettier --check .`: sem essa linha, editar a spec ou o plano passa a bloquear o commit da tarefa seguinte:

```
dist
docs
src/lib/api.types.ts
```

`.editorconfig`:

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`commitlint.config.js`:

```js
export default { extends: ["@commitlint/config-conventional"] };
```

`tsconfig.json` — sem `baseUrl` de propósito: ele está depreciado no TypeScript 6, é erro duro, e
o 7 o remove. `paths` resolve relativo ao próprio arquivo de configuração, que é o arranjo que
sobrevive à próxima atualização:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
  },
});
```

`index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>wa-system</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.example.env`:

```
VITE_API_BASE_URL=http://localhost:3333/v1
```

`.env.test`:

```
VITE_API_BASE_URL=http://api.test/v1
```

`src/index.css`:

```css
@import "tailwindcss";
```

`src/tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  localStorage.clear();
});
```

- [ ] **Step 3: Registrar os scripts do package.json**

```bash
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="tsc && vite build"
npm pkg set scripts.preview="vite preview"
npm pkg set scripts.typecheck="tsc"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.api:types="openapi-typescript ../wa-api/openapi.json -o src/lib/api.types.ts"
npm pkg set scripts.lint:prettier:check="prettier --check ."
npm pkg set scripts.lint:prettier:fix="prettier --write ."
npm pkg set scripts.prepare="husky"
```

- [ ] **Step 4: Escrever o teste que falha**

`src/lib/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("returns the API base url when the environment is complete", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "http://api.test/v1" })).toEqual({ apiUrl: "http://api.test/v1" });
  });

  it("drops a trailing slash so callers can always prepend a path", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "http://api.test/v1/" })).toEqual({ apiUrl: "http://api.test/v1" });
  });

  it("refuses a missing base url instead of building requests against undefined", () => {
    expect(() => parseEnv({})).toThrow(/VITE_API_BASE_URL/);
  });

  it("refuses a base url written without a scheme", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "localhost:3333" })).toThrow(/VITE_API_BASE_URL/);
  });

  it("refuses a scheme the browser cannot fetch over", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "ftp://api.test/v1" })).toThrow(/VITE_API_BASE_URL/);
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/lib/env.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/env"`.

- [ ] **Step 6: Escrever a implementação mínima**

`src/lib/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  // `z.url()` alone delegates to the WHATWG parser, which reads `localhost:3333`
  // as scheme `localhost` and accepts it — and accepts `ftp://` too. Pinning the
  // protocol is what makes the common misconfiguration, a base url written with
  // no scheme, fail at boot instead of at the first request. Same shape the
  // wa-api uses for its own DATABASE_URL.
  VITE_API_BASE_URL: z.url({ protocol: /^https?$/ }),
});

export interface Env {
  apiUrl: string;
}

// Failing here is failing at boot, with the offending variable named. An app that
// starts with an undefined base url only fails later, at the first request, as a
// network error that says nothing about its cause.
export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return { apiUrl: result.data.VITE_API_BASE_URL.replace(/\/$/, "") };
}

export const env = parseEnv(import.meta.env);
```

- [ ] **Step 7: Rodar o teste e confirmar o verde**

Run: `npm test -- src/lib/env.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 8: Escrever o ponto de entrada e confirmar que o build passa**

`src/app/App.tsx`:

```tsx
export function App() {
  return <p>wa-system</p>;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Run: `npm run typecheck && npm run build`
Expected: ambos terminam sem erro, e `dist/` é criado.

- [ ] **Step 9: Instalar os ganchos de commit**

```bash
npx husky init
printf '%s\n' 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
printf '%s\n' 'npm run lint:prettier:check' > .husky/pre-commit
npm run lint:prettier:fix
```

- [ ] **Step 10: Commit**

A spec e o plano são versionados no seu próprio commit, separados do esqueleto — o commit diz uma
coisa só:

```bash
git add docs/
git commit -m "docs(web): add the foundation design and its implementation plan"

git add .editorconfig .env.test .example.env .gitignore .husky .nvmrc .prettierignore .prettierrc \
  commitlint.config.js index.html package.json package-lock.json tsconfig.json vite.config.ts src/
git commit -m "chore(web): scaffold the project with a validated environment"
```

---

## Task 2: Contrato tipado, gerado do OpenAPI

Esta é a única tarefa autorizada a tocar o `wa-api`, e apenas para os dois arquivos descritos.

**Files:**

- Create: `../wa-api/scripts/dump-openapi.ts`
- Create: `../wa-api/openapi.json` (gerado, versionado)
- Modify: `../wa-api/package.json` (um script)
- Create: `src/lib/api.types.ts` (gerado, versionado)
- Create: `src/lib/api.ts`
- Create: `src/tests/samples.ts`

**Interfaces:**

- Consumes: nada de tarefas anteriores.
- Produces: de `@/lib/api`, os tipos `LoginBody`, `SessionTokens`, `CurrentUser`, `ChangePasswordBody`, `Role`, `CreateRoleBody`, `UpdateRoleBody` e `Permission`. De `@/tests/samples`, as fábricas `aSessionTokens(over?)`, `aCurrentUser(over?)` e `aRole(over?)`, cada uma devolvendo o tipo correspondente já preenchido.

- [ ] **Step 1: Escrever o script de serialização no `wa-api`**

`../wa-api/scripts/dump-openapi.ts`:

```ts
import { writeFileSync } from "node:fs";
import { buildApp } from "../src/app.js";

// Serializing the document from the built app, rather than fetching it from a
// running server, is what lets the front end regenerate its types with nothing
// but a checkout: no port listening, no database up.
const app = await buildApp();
const document = app.swagger();

writeFileSync(new URL("../openapi.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
await app.close();

console.log("openapi.json written");
```

- [ ] **Step 2: Registrar o script e gerar o documento**

```bash
cd ../wa-api
npm pkg set scripts.openapi:dump="tsx scripts/dump-openapi.ts"
npm run openapi:dump
cd ../wa-web
```

Expected: `openapi.json written`, e `../wa-api/openapi.json` existe contendo as chaves `/v1/sessions/signin`, `/v1/sessions/me` e `/v1/roles`.

Verificação: `grep -c '"/v1/roles"' ../wa-api/openapi.json` devolve `1`.

O script lê as variáveis de ambiente do `wa-api` (`JWT_SECRET`, `DATABASE_URL` e as demais exigidas por `loadEnv`), mas não abre conexão com o banco. Se o `.env` do `wa-api` não estiver presente, o comando falha com a lista de variáveis faltando — é a mesma exigência de qualquer script daquele repositório.

- [ ] **Step 3: Escrever o teste que falha**

`src/tests/samples.ts`:

```ts
import type { CurrentUser, Role, SessionTokens } from "@/lib/api";

// These factories are the contract test. They are typed by the generated types,
// so a mock that invents a field, or forgets one, stops compiling — which is what
// keeps the suite from passing against an API that does not exist.
export function aSessionTokens(over: Partial<SessionTokens> = {}): SessionTokens {
  return { accessToken: "access-token", refreshToken: "refresh-token", ...over };
}

export function aCurrentUser(over: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "018f0000-0000-7000-8000-000000000001",
    name: "Operador",
    username: "operador",
    roleId: null,
    permissions: ["ACCESS_READ"],
    ...over,
  };
}

export function aRole(over: Partial<Role> = {}): Role {
  return {
    id: "018f0000-0000-7000-8000-000000000010",
    name: "Gerente",
    permissions: ["ACCESS_READ", "ACCESS_CREATE"],
    ...over,
  };
}
```

- [ ] **Step 4: Rodar a verificação de tipos e confirmar o vermelho**

Run: `npm run typecheck`
Expected: FAIL — `Cannot find module '@/lib/api'`.

- [ ] **Step 5: Gerar os tipos e escrever os apelidos**

```bash
npm run api:types
```

`src/lib/api.ts`:

```ts
import type { paths } from "@/lib/api.types";

// The only module in the front end that indexes the generated file. If a path or
// a shape moves in the API, tsc complains here and nowhere else.
type JsonOf<T> = T extends { content: { "application/json": infer B } } ? B : never;
type Body<Op> = Op extends { requestBody?: infer R } ? JsonOf<NonNullable<R>> : never;
type Response<Op, Status extends number> = Op extends { responses: infer R }
  ? Status extends keyof R
    ? JsonOf<R[Status]>
    : never
  : never;

export type LoginBody = Body<paths["/v1/sessions/signin"]["post"]>;
export type SessionTokens = Response<paths["/v1/sessions/signin"]["post"], 200>;
export type CurrentUser = Response<paths["/v1/sessions/me"]["get"], 200>;
export type ChangePasswordBody = Body<paths["/v1/sessions/me/password"]["patch"]>;

export type Role = Response<paths["/v1/roles"]["get"], 200>[number];
export type CreateRoleBody = Body<paths["/v1/roles"]["post"]>;
export type UpdateRoleBody = Body<paths["/v1/roles/{id}"]["patch"]>;

export type Permission = Role["permissions"][number];
```

- [ ] **Step 6: Rodar a verificação de tipos e confirmar o verde**

Run: `npm run typecheck`
Expected: PASS, sem saída de erro.

Se algum apelido resolver para `never`, o `typecheck` acusa no `src/tests/samples.ts`, que é onde os valores concretos são atribuídos. Nesse caso, o defeito está no caminho indexado em `src/lib/api.ts` — confira o nome exato da rota no `../wa-api/openapi.json` e corrija ali, nunca editando `api.types.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.types.ts src/lib/api.ts src/tests/samples.ts package.json
git commit -m "feat(web): derive the API contract types from the generated OpenAPI document"
```

E, no `wa-api`, um commit separado — a autorização cobre apenas estes arquivos:

```bash
cd ../wa-api
git add scripts/dump-openapi.ts openapi.json package.json
git commit -m "chore(api): serialize the OpenAPI document to a versioned file"
cd ../wa-web
```

---

## Task 3: Onde o par de tokens vive

**Files:**

- Create: `src/lib/tokens.ts`
- Test: `src/lib/tokens.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: de `@/lib/tokens` — `getAccessToken(): string | null`, `setAccessToken(token: string | null): void`, `getRefreshToken(): string | null`, `setRefreshToken(token: string): void`, `clearSession(): void`, e a constante `REFRESH_TOKEN_KEY: string`.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/tokens.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  REFRESH_TOKEN_KEY,
  setAccessToken,
  setRefreshToken,
} from "@/lib/tokens";

describe("token storage", () => {
  beforeEach(() => {
    clearSession();
  });

  it("starts with no session at all", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("keeps the access token in memory, out of storage", () => {
    setAccessToken("access-token");

    expect(getAccessToken()).toBe("access-token");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("persists the refresh token so the session survives a reload", () => {
    setRefreshToken("refresh-token");

    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("reads the refresh token another tab wrote", () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "written-by-another-tab");

    expect(getRefreshToken()).toBe("written-by-another-tab");
  });

  it("clears both halves, so signing out leaves nothing behind", () => {
    setAccessToken("access-token");
    setRefreshToken("refresh-token");

    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/lib/tokens.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/tokens"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/lib/tokens.ts`:

```ts
export const REFRESH_TOKEN_KEY = "wa.refresh";

// The access token is short-lived and stays in memory: a reload throws it away,
// and nothing that reads storage after the fact can find it.
//
// The refresh token has to survive a reload, and the API hands it over in the
// response body rather than an httpOnly cookie, so storage is the only place it
// can go. Reading it from storage — never from a variable — is also what lets a
// tab see the rotation another tab performed.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearSession(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/lib/tokens.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts src/lib/tokens.test.ts
git commit -m "feat(web): hold the access token in memory and the refresh token in storage"
```

---

## Task 4: A trava que serializa a rotação

O `wa-api` trata um refresh token repetido como roubo e revoga a sessão inteira do usuário, em todos os dispositivos. Esta tarefa é a defesa contra isso.

**Files:**

- Create: `src/lib/refresh-lock.ts`
- Test: `src/lib/refresh-lock.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: de `@/lib/refresh-lock` — `withRefreshLock<T>(task: () => Promise<T>): Promise<T>`, que executa `task` em exclusão mútua. Entre abas da mesma origem quando `navigator.locks` existe; apenas dentro da aba quando não existe.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/refresh-lock.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { withRefreshLock } from "@/lib/refresh-lock";

function giveWebLocks(request: (name: string, task: () => Promise<unknown>) => Promise<unknown>): void {
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

function takeWebLocksAway(): void {
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
};

afterEach(() => {
  takeWebLocksAway();
  vi.restoreAllMocks();
});

describe("withRefreshLock", () => {
  it("delegates to Web Locks under a fixed name, so every tab contends for the same lock", async () => {
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => task());
    giveWebLocks(request);

    await expect(withRefreshLock(async () => "rotated")).resolves.toBe("rotated");
    expect(request).toHaveBeenCalledWith("wa.refresh", expect.any(Function));
  });

  it("serializes tasks inside the tab when Web Locks is unavailable", async () => {
    takeWebLocksAway();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const order: string[] = [];
    const first = deferred();

    const one = withRefreshLock(async () => {
      order.push("first started");
      await first.promise;
      order.push("first finished");
    });
    const two = withRefreshLock(async () => {
      order.push("second started");
    });

    first.resolve();
    await Promise.all([one, two]);

    expect(order).toEqual(["first started", "first finished", "second started"]);
  });

  it("warns out loud that cross-tab serialization was lost", async () => {
    takeWebLocksAway();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await withRefreshLock(async () => undefined);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTPS"));
  });

  it("does not wedge the queue when a task rejects", async () => {
    takeWebLocksAway();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(withRefreshLock(async () => Promise.reject(new Error("refresh failed")))).rejects.toThrow(
      "refresh failed",
    );
    await expect(withRefreshLock(async () => "still works")).resolves.toBe("still works");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/lib/refresh-lock.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/refresh-lock"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/lib/refresh-lock.ts`:

```ts
const LOCK_NAME = "wa.refresh";

/** Fallback queue, used only when Web Locks is unavailable. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Serializes refresh-token rotation.
 *
 * The API rotates the refresh token on every use and reads a replayed token as
 * theft, revoking the user's whole session on every device. Two requests racing
 * on a 401 — or two tabs — would send the same token twice and log the operator
 * out with no explanation.
 *
 * Web Locks serializes across tabs of the same origin, which is exactly where an
 * in-memory queue fails. It is secure-context only, so serving the app over
 * plain HTTP loses it — a normal condition on a small office LAN, not an exotic
 * one. There we degrade to serializing inside this tab, and say so out loud.
 */
export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks) {
    return navigator.locks.request(LOCK_NAME, task) as Promise<T>;
  }

  console.warn(
    "Web Locks is unavailable — it needs a secure context. Refresh-token rotation is serialized inside this tab " +
      "only, not across tabs. Serve the app over HTTPS.",
  );

  // `run.catch` is what keeps a failed task from wedging the queue: it guarantees
  // the tail is always a settled, never-rejecting promise.
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);

  return run;
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/lib/refresh-lock.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/refresh-lock.ts src/lib/refresh-lock.test.ts
git commit -m "feat(web): serialize refresh-token rotation across tabs"
```

---

## Task 5: Cliente HTTP com renovação de voo único

**Files:**

- Create: `src/lib/http.ts`
- Create: `src/tests/msw-server.ts`
- Modify: `src/tests/setup.ts`
- Test: `src/lib/http.test.ts`

**Interfaces:**

- Consumes: `env` de `@/lib/env`; `withRefreshLock` de `@/lib/refresh-lock`; `getAccessToken`, `setAccessToken`, `getRefreshToken`, `setRefreshToken`, `clearSession` de `@/lib/tokens`.
- Produces: de `@/lib/http` — `class ApiError extends Error` com `status: number` e `body: unknown`; `class SessionExpiredError extends ApiError`; `request<T>(path: string, init?: RequestOptions): Promise<T>`, onde `RequestOptions = Omit<RequestInit, "body"> & { body?: BodyInit | (() => BodyInit) | null }`. De `@/tests/msw-server` — `server` e `apiUrl(path: string): string`.

`ApiError.message` é texto de diagnóstico para quem lê log, **nunca** para a tela: quem renderiza traduz a partir de `status`.

- [ ] **Step 1: Escrever a infraestrutura de mocks e o teste que falha**

`src/tests/msw-server.ts`:

```ts
import { setupServer } from "msw/node";
import { env } from "@/lib/env";

export const server = setupServer();

/** Builds an absolute URL for a handler, from the same base the client uses. */
export function apiUrl(path: string): string {
  return `${env.apiUrl}${path}`;
}
```

`src/tests/setup.ts` (substitui o conteúdo da Task 1):

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/tests/msw-server";

// `onUnhandledRequest: "error"` is deliberate: a test that reaches an endpoint
// nobody declared should fail loudly, not silently hit the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
```

`src/lib/http.test.ts`:

```ts
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError, request, SessionExpiredError } from "@/lib/http";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aRole, aSessionTokens } from "@/tests/samples";

beforeEach(() => {
  clearSession();
});

describe("request", () => {
  it("parses the body of a successful response", async () => {
    const role = aRole();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([role])));

    await expect(request("/roles")).resolves.toEqual([role]);
  });

  it("sends the access token when there is one", async () => {
    setAccessToken("access-token");
    let seen: string | null = null;
    server.use(
      http.get(apiUrl("/roles"), ({ request: received }) => {
        seen = received.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );

    await request("/roles");

    expect(seen).toBe("Bearer access-token");
  });

  it("returns nothing for 204, instead of choking on an empty body", async () => {
    setAccessToken("access-token");
    server.use(http.delete(apiUrl("/roles/1"), () => new HttpResponse(null, { status: 204 })));

    await expect(request("/roles/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the status and the parsed body", async () => {
    setAccessToken("access-token");
    server.use(
      http.post(apiUrl("/roles"), () =>
        HttpResponse.json({ message: "A role with this name already exists." }, { status: 409 }),
      ),
    );

    const error = await request("/roles", { method: "POST", body: "{}" }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).body).toEqual({ message: "A role with this name already exists." });
  });

  it("refreshes once for many requests racing on a 401, and replays them all", async () => {
    setAccessToken("stale-token");
    setRefreshToken("refresh-one");
    let refreshCalls = 0;

    server.use(
      http.post(apiUrl("/sessions/refresh"), async () => {
        refreshCalls += 1;
        return HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-two" }));
      }),
      http.get(apiUrl("/roles"), ({ request: received }) =>
        received.headers.get("Authorization") === "Bearer fresh-token"
          ? HttpResponse.json([aRole()])
          : HttpResponse.json({ message: "Authentication required." }, { status: 401 }),
      ),
    );

    const results = await Promise.all([request("/roles"), request("/roles"), request("/roles")]);

    expect(refreshCalls).toBe(1);
    expect(results).toEqual([[aRole()], [aRole()], [aRole()]]);
    expect(getAccessToken()).toBe("fresh-token");
    expect(getRefreshToken()).toBe("refresh-two");
  });

  it("reads the refresh token inside the lock, so it never replays one another tab rotated", async () => {
    setAccessToken("stale-token");
    setRefreshToken("rotated-by-another-tab");
    let sent: string | null = null;

    server.use(
      http.post(apiUrl("/sessions/refresh"), async ({ request: received }) => {
        sent = ((await received.json()) as { refreshToken: string }).refreshToken;
        return HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-three" }));
      }),
      http.get(apiUrl("/roles"), ({ request: received }) =>
        received.headers.get("Authorization") === "Bearer fresh-token"
          ? HttpResponse.json([])
          : HttpResponse.json({ message: "Authentication required." }, { status: 401 }),
      ),
    );

    await request("/roles");

    expect(sent).toBe("rotated-by-another-tab");
  });

  it("ends the session when the API rejects the refresh token", async () => {
    setAccessToken("stale-token");
    setRefreshToken("revoked");
    server.use(
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
      http.get(apiUrl("/roles"), () => HttpResponse.json({ message: "Authentication required." }, { status: 401 })),
    );

    await expect(request("/roles")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("keeps the session when the refresh fails for a reason that is not the token", async () => {
    setAccessToken("stale-token");
    setRefreshToken("still-good");
    server.use(
      http.post(apiUrl("/sessions/refresh"), () => new HttpResponse(null, { status: 502 })),
      http.get(apiUrl("/roles"), () => HttpResponse.json({ message: "Authentication required." }, { status: 401 })),
    );

    const error = await request("/roles").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
    expect((error as ApiError).status).toBe(502);
    expect(getRefreshToken()).toBe("still-good");
  });

  it("does not intercept the sign-in route, so a wrong password is not read as an expired session", async () => {
    setRefreshToken("refresh-one");
    let refreshCalls = 0;
    server.use(
      http.post(apiUrl("/sessions/refresh"), () => {
        refreshCalls += 1;
        return HttpResponse.json(aSessionTokens());
      }),
      http.post(apiUrl("/sessions/signin"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    const error = await request("/sessions/signin", { method: "POST", body: "{}" }).catch((thrown: unknown) => thrown);

    expect(refreshCalls).toBe(0);
    expect((error as ApiError).status).toBe(401);
    expect(error).not.toBeInstanceOf(SessionExpiredError);
  });

  it("re-evaluates a function body on the replay, so it carries the token the API will accept", async () => {
    setAccessToken("stale-token");
    setRefreshToken("refresh-one");
    const sentTokens: string[] = [];

    server.use(
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json(aSessionTokens({ accessToken: "fresh-token", refreshToken: "refresh-two" })),
      ),
      http.post(apiUrl("/sessions/signout"), async ({ request: received }) => {
        sentTokens.push(((await received.json()) as { refreshToken: string }).refreshToken);
        return received.headers.get("Authorization") === "Bearer fresh-token"
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ message: "Authentication required." }, { status: 401 });
      }),
    );

    await request("/sessions/signout", {
      method: "POST",
      body: () => JSON.stringify({ refreshToken: getRefreshToken() }),
    });

    expect(sentTokens).toEqual(["refresh-one", "refresh-two"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/lib/http.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/http"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/lib/http.ts`:

```ts
import { env } from "@/lib/env";
import { withRefreshLock } from "@/lib/refresh-lock";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";
import type { SessionTokens } from "@/lib/api";

/**
 * `message` is diagnostic text for whoever reads a log. It is never rendered:
 * the API answers in English and the interface is in Portuguese, so screens
 * translate from `status`, not from here.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API responded ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** The session is over and the user has to sign in again. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, null);
    this.name = "SessionExpiredError";
  }
}

/**
 * Routes the interceptor must leave alone, keyed on method and path. A failing
 * refresh cannot be allowed to call itself, and a rejected sign-in is a
 * credential error the user needs to read — not an expired session. Sign-out is
 * deliberately absent: it is bearer-gated, so it has to be intercepted like any
 * other call, or a sign-out after the access token expired revokes nothing.
 */
const UNINTERCEPTED_ROUTES = ["POST /sessions/signin", "POST /sessions/refresh"];

type RequestBody = BodyInit | (() => BodyInit) | null;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /**
   * A plain body is sent as-is. A function is called once per attempt, so a
   * replay after a rotation carries the value that is current then — the
   * sign-out body has to hold the refresh token the API will actually accept.
   */
  body?: RequestBody;
}

function buildInit(init: RequestOptions, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  const body = typeof init.body === "function" ? init.body() : init.body;

  if (typeof body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  return { ...init, body, headers };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);

  return new ApiError(response.status, body);
}

async function ensureFreshAccessToken(staleToken: string | null): Promise<string> {
  return withRefreshLock(async () => {
    // Another request in this tab may have rotated while we waited for the lock.
    // The access token is per-tab memory, so this short-circuit only ever fires
    // for same-tab races; it does nothing for another tab.
    const current = getAccessToken();
    if (current !== null && current !== staleToken) return current;

    // Read the refresh token from storage INSIDE the lock. This is what makes
    // the cross-tab case safe: another tab may have rotated already and written
    // the new token here. Reading it before the lock would send the old one, and
    // the API reads a replay as theft.
    const refreshToken = getRefreshToken();

    if (refreshToken === null) {
      clearSession();
      throw new SessionExpiredError();
    }

    let response: Response;

    try {
      response = await fetch(`${env.apiUrl}/sessions/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Unreachable API. The stored refresh token is still good, so this is a
      // retry, not a sign-out.
      throw new ApiError(0, null);
    }

    if (!response.ok) {
      // Only the API saying "this token is no longer yours" ends the session. A
      // 502 from a restarting API would otherwise throw away a refresh token the
      // server still honours and force a needless sign-in.
      if (response.status === 401 || response.status === 403) {
        clearSession();
        throw new SessionExpiredError();
      }

      throw await toApiError(response);
    }

    const pair = (await response.json()) as SessionTokens;

    setRefreshToken(pair.refreshToken);
    setAccessToken(pair.accessToken);

    return pair.accessToken;
  });
}

export async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const interceptable = !UNINTERCEPTED_ROUTES.includes(`${method} ${path}`);
  const token = getAccessToken();

  let response = await fetch(`${env.apiUrl}${path}`, buildInit(init, token));

  if (response.status === 401 && interceptable) {
    const fresh = await ensureFreshAccessToken(token);
    response = await fetch(`${env.apiUrl}${path}`, buildInit(init, fresh));

    if (response.status === 401) {
      clearSession();
      throw new SessionExpiredError();
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/lib/http.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test && npm run typecheck`
Expected: PASS, sem regressão nas tarefas anteriores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/http.ts src/lib/http.test.ts src/tests/msw-server.ts src/tests/setup.ts
git commit -m "feat(web): refresh the session once on 401 and replay the request"
```

---

## Task 6: Política de cache e de repetição

**Files:**

- Create: `src/lib/query.ts`
- Test: `src/lib/query.test.ts`

**Interfaces:**

- Consumes: `ApiError` de `@/lib/http`.
- Produces: de `@/lib/query` — `createQueryClient(): QueryClient` e `shouldRetry(failureCount: number, error: unknown): boolean`, exportada para poder ser testada sem montar um cliente.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http";
import { createQueryClient, shouldRetry } from "@/lib/query";

describe("shouldRetry", () => {
  it("does not retry what the server refused on purpose", () => {
    expect(shouldRetry(0, new ApiError(403, null))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, null))).toBe(false);
    expect(shouldRetry(0, new ApiError(409, null))).toBe(false);
  });

  it("retries a server fault, which is usually transient", () => {
    expect(shouldRetry(0, new ApiError(502, null))).toBe(true);
  });

  it("retries an unreachable API", () => {
    expect(shouldRetry(0, new ApiError(0, null))).toBe(true);
  });

  it("gives up after two attempts, instead of hammering a down server", () => {
    expect(shouldRetry(2, new ApiError(502, null))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("does not refetch on window focus, which a tablet triggers all day long", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("keeps data fresh for long enough that navigating back does not refetch", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(30_000);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/lib/query.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/query"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/lib/query.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/http";

const MAX_ATTEMPTS = 2;
const STALE_TIME_MS = 30_000;

/**
 * A 4xx is the server having decided: repeating it changes nothing and only
 * delays the error the operator has to read. A 5xx, or an unreachable API, is
 * worth another attempt.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_ATTEMPTS) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;

  return true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        // A tablet on the shop floor leaves and re-enters the app all day. The
        // default would turn every return into a burst of requests, which the
        // operator reads as the screen freezing.
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/lib/query.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/query.ts src/lib/query.test.ts
git commit -m "feat(web): tune cache freshness and the retry policy for shop-floor use"
```

---

## Task 7: Sessão em React

**Files:**

- Create: `src/features/auth/auth.api.ts`
- Create: `src/features/auth/session-context.tsx`
- Create: `src/features/auth/use-session.ts`
- Create: `src/app/providers.tsx`
- Create: `src/tests/render.tsx`
- Modify: `src/main.tsx`
- Test: `src/features/auth/session-context.test.tsx`

**Interfaces:**

- Consumes: `request` de `@/lib/http`; tokens de `@/lib/tokens`; `createQueryClient` de `@/lib/query`; tipos de `@/lib/api`.
- Produces:
  - de `@/features/auth/auth.api` — `requestSignIn(body: LoginBody): Promise<SessionTokens>`, `fetchCurrentUser(): Promise<CurrentUser>`, `requestSignOut(): Promise<void>`, `changeOwnPassword(body: ChangePasswordBody): Promise<void>`;
  - de `@/features/auth/session-context` — `SessionProvider`, `SessionContext`, `SESSION_QUERY_KEY`, e o tipo `SessionValue = { status: "loading" | "authenticated" | "anonymous"; user: CurrentUser | null; can(permission: Permission): boolean; signIn(body: LoginBody): Promise<void>; signOut(): Promise<void> }`;
  - de `@/features/auth/use-session` — `useSession(): SessionValue`;
  - de `@/tests/render` — `renderWithProviders(ui: ReactElement, options?: { route?: string }): RenderResult`.

- [ ] **Step 1: Escrever o teste que falha**

`src/tests/render.tsx`:

```tsx
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SessionProvider } from "@/features/auth/session-context";

/** Retries are off here: a test asserting an error state should not wait for them. */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, { route = "/" }: { route?: string } = {}): RenderResult {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <SessionProvider>{ui}</SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
```

`src/features/auth/session-context.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "@/features/auth/use-session";
import { getRefreshToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aSessionTokens } from "@/tests/samples";

function SessionProbe() {
  const { status, user, can, signIn, signOut } = useSession();

  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.name ?? "none"}</p>
      <p data-testid="can-read">{String(can("ACCESS_READ"))}</p>
      <button onClick={() => void signIn({ username: "operador", password: "secret123" })}>entrar</button>
      <button onClick={() => void signOut()}>sair</button>
    </div>
  );
}

describe("SessionProvider", () => {
  it("is anonymous with no stored session, and asks the API nothing", async () => {
    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });

  it("rehydrates a stored session on boot", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ name: "Ana" }))));

    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("Ana");
  });

  it("falls back to anonymous when the stored refresh token is no longer accepted", async () => {
    setRefreshToken("revoked");
    server.use(
      http.get(apiUrl("/sessions/me"), () =>
        HttpResponse.json({ message: "Authentication required." }, { status: 401 }),
      ),
      http.post(apiUrl("/sessions/refresh"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });

  it("stores the pair and loads the user when signing in", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json(aSessionTokens({ refreshToken: "refresh-new" }))),
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ name: "Ana" }))),
    );

    renderWithProviders(<SessionProbe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    await userEvent.click(screen.getByRole("button", { name: "entrar" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(getRefreshToken()).toBe("refresh-new");
  });

  it("answers what the user may do, from the permissions the API returned", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
    );

    renderWithProviders(<SessionProbe />);

    await waitFor(() => expect(screen.getByTestId("can-read")).toHaveTextContent("true"));
  });

  it("clears the session locally even when revoking it on the API fails", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())),
      http.post(apiUrl("/sessions/signout"), () => new HttpResponse(null, { status: 502 })),
    );

    renderWithProviders(<SessionProbe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await userEvent.click(screen.getByRole("button", { name: "sair" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(getRefreshToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/auth/session-context.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/auth/session-context"`.

- [ ] **Step 3: Escrever a camada de API**

`src/features/auth/auth.api.ts`:

```ts
import type { ChangePasswordBody, CurrentUser, LoginBody, SessionTokens } from "@/lib/api";
import { request } from "@/lib/http";
import { getRefreshToken } from "@/lib/tokens";

export function requestSignIn(body: LoginBody): Promise<SessionTokens> {
  return request<SessionTokens>("/sessions/signin", { method: "POST", body: JSON.stringify(body) });
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>("/sessions/me");
}

// The body is a function on purpose: if the access token expired, this call is
// replayed after a rotation, and the replay has to carry the refresh token the
// API will accept — not the one that was current when the call started.
export function requestSignOut(): Promise<void> {
  return request<void>("/sessions/signout", {
    method: "POST",
    body: () => JSON.stringify({ refreshToken: getRefreshToken() }),
  });
}

export function changeOwnPassword(body: ChangePasswordBody): Promise<void> {
  return request<void>("/sessions/me/password", { method: "PATCH", body: JSON.stringify(body) });
}
```

- [ ] **Step 4: Escrever o contexto de sessão**

`src/features/auth/session-context.tsx`:

```tsx
import { createContext, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, requestSignIn, requestSignOut } from "@/features/auth/auth.api";
import type { CurrentUser, LoginBody, Permission } from "@/lib/api";
import { clearSession, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";

export const SESSION_QUERY_KEY = ["session", "me"] as const;

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface SessionValue {
  status: SessionStatus;
  user: CurrentUser | null;
  can: (permission: Permission) => boolean;
  signIn: (body: LoginBody) => Promise<void>;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // No stored refresh token means there is nothing to rehydrate, and asking the
  // API would only produce a 401 we already know the answer to.
  const hasStoredSession = getRefreshToken() !== null;

  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentUser,
    enabled: hasStoredSession,
    // A failed rehydration is an answer, not a fault worth retrying: the HTTP
    // layer already tried to rotate the token before giving up.
    retry: false,
    staleTime: Infinity,
  });

  const user = query.data ?? null;

  const signIn = useCallback(
    async (body: LoginBody) => {
      const pair = await requestSignIn(body);

      setRefreshToken(pair.refreshToken);
      setAccessToken(pair.accessToken);
      queryClient.setQueryData(SESSION_QUERY_KEY, await fetchCurrentUser());
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      if (getRefreshToken() !== null) await requestSignOut();
    } catch {
      // Leaving is a local act. A revoke the API refused must not trap the
      // operator inside a session they asked to end.
    }

    clearSession();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionValue>(() => {
    const status: SessionStatus =
      user !== null ? "authenticated" : !hasStoredSession || query.isError ? "anonymous" : "loading";

    return {
      status,
      user,
      can: (permission) => user?.permissions.includes(permission) ?? false,
      signIn,
      signOut,
    };
  }, [hasStoredSession, query.isError, signIn, signOut, user]);

  return <SessionContext value={value}>{children}</SessionContext>;
}
```

`src/features/auth/use-session.ts`:

```ts
import { useContext } from "react";
import { SessionContext, type SessionValue } from "@/features/auth/session-context";

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (value === null) throw new Error("useSession must be used inside a SessionProvider.");

  return value;
}
```

- [ ] **Step 5: Rodar o teste e confirmar o verde**

Run: `npm test -- src/features/auth/session-context.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 6: Compor os provedores da aplicação**

`src/app/providers.tsx`:

```tsx
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/features/auth/session-context";
import { createQueryClient } from "@/lib/query";

const queryClient = createQueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { Providers } from "@/app/providers";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
```

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS em tudo.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth src/app src/tests/render.tsx src/main.tsx
git commit -m "feat(web): expose the session as context, rehydrated from the stored refresh token"
```

---

## Task 8: Vocabulário visual e tradução de erro

**Files:**

- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (gerados)
- Create: `src/lib/form-errors.ts`
- Create: `src/components/common/QueryErrorState.tsx`
- Modify: `src/index.css` (tokens escritos pelo shadcn)
- Test: `src/lib/form-errors.test.ts`, `src/components/common/QueryErrorState.test.tsx`

**Interfaces:**

- Consumes: `ApiError` de `@/lib/http`.
- Produces:
  - de `@/lib/form-errors` — `messageForError(error: unknown, byStatus?: Partial<Record<number, string>>): string`, que devolve sempre uma frase em português;
  - de `@/components/common/QueryErrorState` — `QueryErrorState({ error, onRetry }: { error: unknown; onRetry: () => void })`;
  - de `@/components/ui/*` — `Button`, `Input`, `Label`, `Checkbox`, `Table` e companhia, `Dialog`, `AlertDialog`, `Badge`, `Toaster`;
  - de `@/lib/utils` — `cn(...inputs: ClassValue[]): string`.

- [ ] **Step 1: Instalar o conjunto de componentes**

```bash
npx shadcn@latest init --base-color neutral --yes
npx shadcn@latest add button input label checkbox table dialog alert-dialog badge sonner --yes
```

Verificação: `components.json` existe e contém `"style": "base-nova"`, `"iconLibrary": "lucide"` e os apelidos `@/components`, `@/components/ui`, `@/lib` e `@/lib/utils`. `src/index.css` passou a conter as variáveis de tema além do `@import "tailwindcss"`. `src/lib/utils.ts` exporta `cn`.

Se o comando pedir alguma resposta interativa, os valores são: TypeScript sim, cor base `neutral`, variáveis CSS sim, arquivo de CSS `src/index.css`, apelido de componentes `@/components`, apelido de utilidades `@/lib/utils`, biblioteca de ícones `lucide`.

Run: `npm run typecheck && npm run build`
Expected: PASS. Se algum componente gerado não compilar sob `noUnusedParameters`, ajuste o componente gerado — ele agora é código deste repositório.

- [ ] **Step 2: Escrever o teste que falha**

`src/lib/form-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { messageForError } from "@/lib/form-errors";
import { ApiError, SessionExpiredError } from "@/lib/http";

describe("messageForError", () => {
  it("prefers the caller's wording for a status it knows the meaning of", () => {
    expect(messageForError(new ApiError(409, null), { 409: "Já existe um papel com esse nome." })).toBe(
      "Já existe um papel com esse nome.",
    );
  });

  it("explains an unreachable API instead of blaming the operator", () => {
    expect(messageForError(new ApiError(0, null))).toBe(
      "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    );
  });

  it("says the session ended, which is not the same as an operation that failed", () => {
    expect(messageForError(new SessionExpiredError())).toBe("Sua sessão expirou. Entre novamente.");
  });

  it("never leaks the API's own English message to the screen", () => {
    const message = messageForError(new ApiError(500, { message: "Something exploded." }));

    expect(message).not.toContain("Something exploded.");
    expect(message).toBe("Não foi possível concluir a operação. Tente de novo.");
  });

  it("survives something that is not an ApiError at all", () => {
    expect(messageForError(new TypeError("boom"))).toBe("Não foi possível concluir a operação. Tente de novo.");
  });
});
```

`src/components/common/QueryErrorState.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Rodar os testes e confirmar o vermelho**

Run: `npm test -- src/lib/form-errors.test.ts src/components/common/QueryErrorState.test.tsx`
Expected: FAIL — `Failed to resolve import "@/lib/form-errors"`.

- [ ] **Step 4: Escrever a implementação mínima**

`src/lib/form-errors.ts`:

```ts
import { ApiError, SessionExpiredError } from "@/lib/http";

const UNREACHABLE = "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";
const EXPIRED = "Sua sessão expirou. Entre novamente.";
const FALLBACK = "Não foi possível concluir a operação. Tente de novo.";

/**
 * The API answers in English and the interface is in Portuguese, so its message
 * never reaches the screen. The caller supplies the wording for the statuses it
 * knows the meaning of in its own context; everything else falls back to a
 * sentence that is honest without pretending to explain.
 */
export function messageForError(error: unknown, byStatus: Partial<Record<number, string>> = {}): string {
  if (!(error instanceof ApiError)) return FALLBACK;
  if (error instanceof SessionExpiredError) return EXPIRED;

  const known = byStatus[error.status];
  if (known !== undefined) return known;

  return error.status === 0 ? UNREACHABLE : FALLBACK;
}
```

`src/components/common/QueryErrorState.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { messageForError } from "@/lib/form-errors";

interface QueryErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

/** A screen is always loading, showing data, or showing this. Never blank. */
export function QueryErrorState({ error, onRetry }: QueryErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 p-4">
      <p>{messageForError(error)}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Rodar os testes e confirmar o verde**

Run: `npm test -- src/lib/form-errors.test.ts src/components/common/QueryErrorState.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 6: Commit**

```bash
git add components.json src/index.css src/lib/utils.ts src/components src/lib/form-errors.ts src/lib/form-errors.test.ts package.json package-lock.json
git commit -m "feat(web): add the visual vocabulary and translate API failures into Portuguese"
```

---

## Task 9: Tela de entrada

**Files:**

- Create: `src/features/auth/LoginPage.tsx`
- Test: `src/features/auth/LoginPage.test.tsx`

**Interfaces:**

- Consumes: `useSession` de `@/features/auth/use-session`; `messageForError` de `@/lib/form-errors`; componentes de `@/components/ui/*`.
- Produces: `LoginPage()` de `@/features/auth/LoginPage`. Ao entrar com sucesso, navega para a rota guardada em `location.state.from` ou, na falta dela, para `/`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/auth/LoginPage.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LoginPage } from "@/features/auth/LoginPage";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aSessionTokens } from "@/tests/samples";

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Início</p>} />
    </Routes>,
    { route: "/login" },
  );
}

describe("LoginPage", () => {
  it("refuses to call the API with empty fields", async () => {
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe o usuário.")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha.")).toBeInTheDocument();
  });

  it("takes the operator to the application after a successful sign-in", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () => HttpResponse.json(aSessionTokens())),
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())),
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Início")).toBeInTheDocument();
  });

  it("says the credentials are wrong, in Portuguese, without echoing the API", async () => {
    server.use(
      http.post(apiUrl("/sessions/signin"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário ou senha inválidos.");
    expect(screen.queryByText(/Invalid credentials/)).not.toBeInTheDocument();
  });

  it("explains an unreachable API differently from a wrong password", async () => {
    server.use(http.post(apiUrl("/sessions/signin"), () => HttpResponse.error()));

    renderLogin();

    await userEvent.type(screen.getByLabelText("Usuário"), "operador");
    await userEvent.type(screen.getByLabelText("Senha"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/auth/LoginPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/auth/LoginPage"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/features/auth/LoginPage.tsx`:

```tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/auth/use-session";
import { messageForError } from "@/lib/form-errors";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuário."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginForm = z.infer<typeof loginSchema>;

// A wrong password and an unknown user are the same answer on purpose — the API
// refuses to tell them apart, and the screen must not undo that.
const SIGN_IN_MESSAGES = { 401: "Usuário ou senha inválidos." };

export function LoginPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);

    try {
      await signIn(values);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (error) {
      setFailure(messageForError(error, SIGN_IN_MESSAGES));
    }
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Usuário</Label>
          <Input id="username" autoComplete="username" autoFocus {...form.register("username")} />
          {form.formState.errors.username ? (
            <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {failure !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Entrar
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/features/auth/LoginPage.test.tsx`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/LoginPage.tsx src/features/auth/LoginPage.test.tsx
git commit -m "feat(web): add the sign-in screen"
```

---

## Task 10: Guardas, casco e tabela de rotas

**Files:**

- Create: `src/features/auth/RequireSession.tsx`
- Create: `src/features/auth/RequirePermission.tsx`
- Create: `src/features/auth/ForbiddenPage.tsx`
- Create: `src/components/common/RouteError.tsx`
- Create: `src/components/layout/nav-items.ts`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/features/home/HomePage.tsx`
- Create: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/features/auth/RequirePermission.test.tsx`, `src/features/auth/RequireSession.test.tsx`, `src/components/layout/AppShell.test.tsx`

**Interfaces:**

- Consumes: `useSession`; `NAV_ITEMS`; componentes de `@/components/ui/*`.
- Produces:
  - `RequireSession()` — elemento de rota que renderiza `<Outlet />` para quem entrou, redireciona anônimo para `/login` levando a rota pedida em `state.from`, e não renderiza nada enquanto a sessão carrega;
  - `RequirePermission({ permission }: { permission: Permission })` — renderiza `<Outlet />` ou `<ForbiddenPage />`;
  - `NAV_ITEMS: readonly NavItem[]`, com `NavItem = { to: string; label: string; permission: Permission }`;
  - `AppShell()`, `HomePage()`, `ForbiddenPage()`, `RouteError()`;
  - `routes: RouteObject[]` e `router` de `@/app/router`.

- [ ] **Step 1: Escrever os testes que falham**

`src/features/auth/RequireSession.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequireSession } from "@/features/auth/RequireSession";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

function renderGuarded(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>Entrar</p>} />
      <Route element={<RequireSession />}>
        <Route path="/roles" element={<p>Papéis</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe("RequireSession", () => {
  it("sends an anonymous visitor to the sign-in screen", async () => {
    renderGuarded("/roles");

    expect(await screen.findByText("Entrar")).toBeInTheDocument();
    expect(screen.queryByText("Papéis")).not.toBeInTheDocument();
  });

  it("lets a signed-in operator through", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())));

    renderGuarded("/roles");

    expect(await screen.findByText("Papéis")).toBeInTheDocument();
  });
});
```

`src/features/auth/RequirePermission.test.tsx`:

```tsx
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
```

`src/components/layout/AppShell.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { getRefreshToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

describe("AppShell", () => {
  it("shows who is signed in", async () => {
    setRefreshToken("refresh-one");
    server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ name: "Ana" }))));

    renderWithProviders(<AppShell />);

    expect(await screen.findByText("Ana")).toBeInTheDocument();
  });

  it("hides a destination the operator may not open", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["CATALOG_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    await screen.findByText("Operador");
    expect(screen.queryByRole("link", { name: "Papéis" })).not.toBeInTheDocument();
  });

  it("offers a destination the operator may open", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ"] }))),
    );

    renderWithProviders(<AppShell />);

    expect(await screen.findByRole("link", { name: "Papéis" })).toHaveAttribute("href", "/roles");
  });

  it("signs the operator out on request, leaving no session behind", async () => {
    setRefreshToken("refresh-one");
    server.use(
      http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())),
      http.post(apiUrl("/sessions/signout"), () => new HttpResponse(null, { status: 204 })),
    );

    renderWithProviders(<AppShell />);
    await screen.findByText("Operador");

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    // The toast is not asserted here: `Toaster` lives in `App`, above this shell,
    // so it is out of this test's tree. What matters is that the session is gone.
    await waitFor(() => expect(getRefreshToken()).toBeNull());
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar o vermelho**

Run: `npm test -- src/features/auth/RequireSession.test.tsx src/features/auth/RequirePermission.test.tsx src/components/layout/AppShell.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/auth/RequireSession"`.

- [ ] **Step 3: Escrever as guardas e as telas de estado**

`src/features/auth/RequireSession.tsx`:

```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "@/features/auth/use-session";

export function RequireSession() {
  const { status } = useSession();
  const location = useLocation();

  // Rendering nothing while the session rehydrates is deliberate: showing the
  // sign-in screen first and then yanking it away is worse than a blank instant.
  if (status === "loading") return null;

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
```

`src/features/auth/RequirePermission.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { ForbiddenPage } from "@/features/auth/ForbiddenPage";
import { useSession } from "@/features/auth/use-session";
import type { Permission } from "@/lib/api";

/**
 * Renders 403 rather than redirecting to the sign-in screen. The API tells "I
 * don't know who you are" apart from "I do, and you may not"; collapsing both
 * into a login prompt would throw that distinction away and confuse the person
 * who is, in fact, signed in.
 */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { status, can } = useSession();

  if (status !== "authenticated") return null;
  if (!can(permission)) return <ForbiddenPage />;

  return <Outlet />;
}
```

`src/features/auth/ForbiddenPage.tsx`:

```tsx
export function ForbiddenPage() {
  return (
    <div className="flex flex-col gap-2 p-6">
      <h1 className="text-xl font-semibold">Acesso negado</h1>
      <p>Você não tem permissão para ver esta tela.</p>
      <p className="text-sm text-muted-foreground">Fale com quem administra o acesso se precisar dela.</p>
    </div>
  );
}
```

`src/components/common/RouteError.tsx`:

```tsx
import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { messageForError } from "@/lib/form-errors";

/** Keeps one screen's failure from taking the whole application down with it. */
export function RouteError() {
  const error = useRouteError();

  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-6">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p>{messageForError(error)}</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Recarregar
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Escrever o casco e o menu**

`src/components/layout/nav-items.ts`:

```ts
import type { Permission } from "@/lib/api";

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

/**
 * The single source of the menu. Each slice adds its own destination here when
 * its screen lands; a path listed here must resolve to a real route.
 */
export const NAV_ITEMS: readonly NavItem[] = [{ to: "/roles", label: "Papéis", permission: "ACCESS_READ" }];
```

`src/components/layout/AppShell.tsx`:

```tsx
import { Link, NavLink, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/use-session";

export function AppShell() {
  const { user, can, signOut } = useSession();

  const destinations = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
        <Link to="/" className="font-semibold">
          wa-system
        </Link>

        <nav className="flex flex-wrap gap-1">
          {destinations.map((item) => (
            <NavLink key={item.to} to={item.to} className="rounded-md px-3 py-2 text-sm aria-[current=page]:bg-accent">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm">{user?.name}</span>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await signOut();
              toast.success("Sessão encerrada.");
            }}
          >
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
```

`src/features/home/HomePage.tsx`:

```tsx
import { useSession } from "@/features/auth/use-session";

export function HomePage() {
  const { user } = useSession();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Bem-vindo, {user?.name}</h1>
      <p className="text-muted-foreground">Escolha uma opção no menu para começar.</p>
    </div>
  );
}
```

`src/app/router.tsx`:

```tsx
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RouteError } from "@/components/common/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireSession } from "@/features/auth/RequireSession";
import { HomePage } from "@/features/home/HomePage";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [{ path: "/", element: <HomePage /> }],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

`src/app/App.tsx`:

```tsx
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/app/router";

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
```

O `Toaster` fica fora do `RouterProvider` de propósito: um aviso disparado durante a saída sobrevive à troca de rota que o acompanha.

- [ ] **Step 5: Rodar os testes e confirmar o verde**

Run: `npm test -- src/features/auth/RequireSession.test.tsx src/features/auth/RequirePermission.test.tsx src/components/layout/AppShell.test.tsx`
Expected: PASS, 8 testes.

Nota para o teste do `AppShell`: ele renderiza o casco fora de um roteador com rotas filhas, então `<Outlet />` fica vazio — é o esperado, o teste só olha cabeçalho, menu e saída.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth src/features/home src/components/layout src/components/common/RouteError.tsx src/app
git commit -m "feat(web): guard routes by session and permission behind an application shell"
```

---

## Task 11: Troca da própria senha

O `wa-api` revoga **todos** os refresh tokens do usuário ao trocar a senha. A sessão atual morre junto, e a tela tem que assumir isso em vez de descobrir depois com um 401 sem explicação.

**Files:**

- Create: `src/features/auth/ChangePasswordPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/auth/ChangePasswordPage.test.tsx`

**Interfaces:**

- Consumes: `changeOwnPassword` de `@/features/auth/auth.api`; `useSession`; `messageForError`.
- Produces: `ChangePasswordPage()`, montada na rota `/change-password` dentro do `AppShell`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/auth/ChangePasswordPage.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
import { getRefreshToken, setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser } from "@/tests/samples";

function renderPage() {
  setRefreshToken("refresh-one");
  server.use(http.get(apiUrl("/sessions/me"), () => HttpResponse.json(aCurrentUser())));

  return renderWithProviders(
    <Routes>
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/login" element={<p>Entrar</p>} />
    </Routes>,
    { route: "/change-password" },
  );
}

async function fill(current: string, next: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText("Senha atual"), current);
  await userEvent.type(screen.getByLabelText("Nova senha"), next);
  await userEvent.type(screen.getByLabelText("Repita a nova senha"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
}

describe("ChangePasswordPage", () => {
  it("refuses a new password shorter than the API accepts, without asking the API", async () => {
    renderPage();

    await fill("old-secret", "short", "short");

    expect(await screen.findByText("A nova senha precisa de pelo menos 8 caracteres.")).toBeInTheDocument();
  });

  it("refuses a confirmation that does not match", async () => {
    renderPage();

    await fill("old-secret", "new-secret-1", "new-secret-2");

    expect(await screen.findByText("As senhas não conferem.")).toBeInTheDocument();
  });

  it("says the current password is wrong, in Portuguese", async () => {
    renderPage();
    server.use(
      http.patch(apiUrl("/sessions/me/password"), () =>
        HttpResponse.json({ message: "Invalid credentials." }, { status: 401 }),
      ),
    );

    await fill("wrong-secret", "new-secret-1", "new-secret-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual não confere.");
  });

  it("ends the session after the change, because the API revoked every token", async () => {
    renderPage();
    server.use(http.patch(apiUrl("/sessions/me/password"), () => new HttpResponse(null, { status: 204 })));

    await fill("old-secret", "new-secret-1", "new-secret-1");

    expect(await screen.findByText("Entrar")).toBeInTheDocument();
    expect(getRefreshToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/auth/ChangePasswordPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/auth/ChangePasswordPage"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/features/auth/ChangePasswordPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword } from "@/features/auth/auth.api";
import { useSession } from "@/features/auth/use-session";
import { messageForError } from "@/lib/form-errors";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres."),
    confirmation: z.string().min(1, "Repita a nova senha."),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ["confirmation"],
    message: "As senhas não conferem.",
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const CHANGE_MESSAGES = { 401: "A senha atual não confere." };

export function ChangePasswordPage() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setFailure(null);

    try {
      await changeOwnPassword({ currentPassword, newPassword });

      // The API revokes every refresh token on a password change, this session's
      // included. Ending it here is telling the truth; waiting for the next call
      // to fail would drop the operator at the sign-in screen with no reason given.
      await signOut();
      toast.success("Senha trocada. Entre de novo com a senha nova.");
      navigate("/login", { replace: true });
    } catch (error) {
      setFailure(messageForError(error, CHANGE_MESSAGES));
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-xl font-semibold">Trocar a senha</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...form.register("currentPassword")}
          />
          {form.formState.errors.currentPassword ? (
            <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("newPassword")} />
          {form.formState.errors.newPassword ? (
            <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmation">Repita a nova senha</Label>
          <Input id="confirmation" type="password" autoComplete="new-password" {...form.register("confirmation")} />
          {form.formState.errors.confirmation ? (
            <p className="text-sm text-destructive">{form.formState.errors.confirmation.message}</p>
          ) : null}
        </div>

        {failure !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Trocar a senha
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Montar a rota**

Em `src/app/router.tsx`, adicione a importação e a rota dentro dos filhos do `AppShell`:

```tsx
import { ChangePasswordPage } from "@/features/auth/ChangePasswordPage";
```

```tsx
children: [
  { path: "/", element: <HomePage /> },
  { path: "/change-password", element: <ChangePasswordPage /> },
],
```

- [ ] **Step 5: Rodar o teste e confirmar o verde**

Run: `npm test -- src/features/auth/ChangePasswordPage.test.tsx`
Expected: PASS, 4 testes.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/ChangePasswordPage.tsx src/features/auth/ChangePasswordPage.test.tsx src/app/router.tsx
git commit -m "feat(web): let the operator change their own password and end the revoked session"
```

---

## Task 12: Vocabulário de permissões

**Files:**

- Create: `src/lib/permissions.ts`
- Test: `src/lib/permissions.test.ts`

**Interfaces:**

- Consumes: `Permission` de `@/lib/api`.
- Produces: de `@/lib/permissions` — `PERMISSIONS: readonly Permission[]` na ordem de exibição, `PERMISSION_LABELS: Record<Permission, string>`, `PERMISSION_GROUPS: readonly { title: string; permissions: readonly Permission[] }[]`, e `labelFor(permission: Permission): string`.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { labelFor, PERMISSION_GROUPS, PERMISSION_LABELS, PERMISSIONS } from "@/lib/permissions";

describe("permission vocabulary", () => {
  it("names every permission in Portuguese", () => {
    for (const permission of PERMISSIONS) {
      expect(PERMISSION_LABELS[permission]).toBeTruthy();
      expect(PERMISSION_LABELS[permission]).not.toBe(permission);
    }
  });

  it("puts every permission in exactly one group, so none is unreachable in a form", () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);

    expect([...grouped].sort()).toEqual([...PERMISSIONS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("answers with the label for a single permission", () => {
    expect(labelFor("ACCESS_READ")).toBe("Ver usuários e papéis");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/lib/permissions.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/permissions"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/lib/permissions.ts`:

```ts
import type { Permission } from "@/lib/api";

/**
 * Display order, and the list a form iterates over. A union type cannot be
 * enumerated at runtime, so this array is written by hand — and `PermissionCoverage`
 * below is what stops it from drifting: add a permission to the API, regenerate
 * the types, and the build fails here until the new one is listed and named.
 */
export const PERMISSIONS = [
  "CATALOG_READ",
  "CATALOG_CREATE",
  "CATALOG_UPDATE",
  "ENTRIES_READ",
  "ENTRIES_CREATE",
  "PRODUCTION_READ",
  "PRODUCTION_CREATE",
  "SALES_READ",
  "SALES_CREATE",
  "REPORTS_READ",
  "ACCESS_READ",
  "ACCESS_CREATE",
  "ACCESS_UPDATE",
] as const satisfies readonly Permission[];

type AssertNever<T extends never> = T;

/** Fails to compile if the API grows a permission this file does not know about. */
export type PermissionCoverage = AssertNever<Exclude<Permission, (typeof PERMISSIONS)[number]>>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  CATALOG_READ: "Ver catálogo",
  CATALOG_CREATE: "Cadastrar no catálogo",
  CATALOG_UPDATE: "Editar o catálogo",
  ENTRIES_READ: "Ver lançamentos",
  ENTRIES_CREATE: "Registrar lançamento",
  PRODUCTION_READ: "Ver produção",
  PRODUCTION_CREATE: "Registrar produção",
  SALES_READ: "Ver vendas",
  SALES_CREATE: "Registrar venda",
  REPORTS_READ: "Ver relatórios",
  ACCESS_READ: "Ver usuários e papéis",
  ACCESS_CREATE: "Criar usuários e papéis",
  ACCESS_UPDATE: "Editar usuários e papéis",
};

export const PERMISSION_GROUPS = [
  { title: "Catálogo", permissions: ["CATALOG_READ", "CATALOG_CREATE", "CATALOG_UPDATE"] },
  { title: "Lançamentos", permissions: ["ENTRIES_READ", "ENTRIES_CREATE"] },
  { title: "Produção", permissions: ["PRODUCTION_READ", "PRODUCTION_CREATE"] },
  { title: "Vendas", permissions: ["SALES_READ", "SALES_CREATE"] },
  { title: "Relatórios", permissions: ["REPORTS_READ"] },
  { title: "Acesso", permissions: ["ACCESS_READ", "ACCESS_CREATE", "ACCESS_UPDATE"] },
] as const satisfies readonly { title: string; permissions: readonly Permission[] }[];

export function labelFor(permission: Permission): string {
  return PERMISSION_LABELS[permission];
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/lib/permissions.test.ts && npm run typecheck`
Expected: PASS, 3 testes, e a verificação de tipos sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts src/lib/permissions.test.ts
git commit -m "feat(web): name every API permission in Portuguese with compile-time coverage"
```

---

## Task 13: Camada de API e chaves de cache dos papéis

**Files:**

- Create: `src/features/roles/roles.api.ts`
- Test: `src/features/roles/roles.api.test.ts`

**Interfaces:**

- Consumes: `request` de `@/lib/http`; tipos de `@/lib/api`.
- Produces: de `@/features/roles/roles.api` — `rolesKeys.all: readonly ["roles"]`, `fetchRoles(): Promise<Role[]>`, `createRole(body: CreateRoleBody): Promise<Role>`, `updateRole(id: string, body: UpdateRoleBody): Promise<Role>`, `deleteRole(id: string): Promise<void>`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/roles/roles.api.test.ts`:

```ts
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createRole, deleteRole, fetchRoles, rolesKeys, updateRole } from "@/features/roles/roles.api";
import { setAccessToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { aRole } from "@/tests/samples";

beforeEach(() => {
  setAccessToken("access-token");
});

describe("roles api", () => {
  it("names the cache entry the whole feature shares", () => {
    expect(rolesKeys.all).toEqual(["roles"]);
  });

  it("lists the roles", async () => {
    const role = aRole();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([role])));

    await expect(fetchRoles()).resolves.toEqual([role]);
  });

  it("creates a role from the name and the chosen permissions", async () => {
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/roles"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole(), { status: 201 });
      }),
    );

    await createRole({ name: "Produção", permissions: ["PRODUCTION_READ"] });

    expect(received).toEqual({ name: "Produção", permissions: ["PRODUCTION_READ"] });
  });

  it("edits a role by id", async () => {
    let received: unknown = null;
    server.use(
      http.patch(apiUrl("/roles/role-1"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole({ name: "Produção" }));
      }),
    );

    await expect(updateRole("role-1", { name: "Produção" })).resolves.toEqual(aRole({ name: "Produção" }));
    expect(received).toEqual({ name: "Produção" });
  });

  it("deletes a role by id", async () => {
    let called = false;
    server.use(
      http.delete(apiUrl("/roles/role-1"), () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(deleteRole("role-1")).resolves.toBeUndefined();
    expect(called).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/roles/roles.api.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/roles/roles.api"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/features/roles/roles.api.ts`:

```ts
import type { CreateRoleBody, Role, UpdateRoleBody } from "@/lib/api";
import { request } from "@/lib/http";

/** The one name for this feature's cache entry. Every mutation invalidates it. */
export const rolesKeys = {
  all: ["roles"] as const,
};

export function fetchRoles(): Promise<Role[]> {
  return request<Role[]>("/roles");
}

export function createRole(body: CreateRoleBody): Promise<Role> {
  return request<Role>("/roles", { method: "POST", body: JSON.stringify(body) });
}

export function updateRole(id: string, body: UpdateRoleBody): Promise<Role> {
  return request<Role>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteRole(id: string): Promise<void> {
  return request<void>(`/roles/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Rodar o teste e confirmar o verde**

Run: `npm test -- src/features/roles/roles.api.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/features/roles
git commit -m "feat(web): add the roles API layer and its cache key"
```

---

## Task 14: Lista de papéis

**Files:**

- Create: `src/features/roles/RolesListPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/roles/RolesListPage.test.tsx`

**Interfaces:**

- Consumes: `fetchRoles`, `rolesKeys` de `@/features/roles/roles.api`; `labelFor` de `@/lib/permissions`; `QueryErrorState`; componentes de tabela.
- Produces: `RolesListPage()`, montada em `/roles` atrás de `RequirePermission permission="ACCESS_READ"`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/roles/RolesListPage.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RolesListPage } from "@/features/roles/RolesListPage";
import { setRefreshToken } from "@/lib/tokens";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aCurrentUser, aRole } from "@/tests/samples";

function signedIn() {
  setRefreshToken("refresh-one");
  server.use(
    http.get(apiUrl("/sessions/me"), () =>
      HttpResponse.json(aCurrentUser({ permissions: ["ACCESS_READ", "ACCESS_CREATE", "ACCESS_UPDATE"] })),
    ),
  );
}

describe("RolesListPage", () => {
  it("lists each role with its permissions named in Portuguese", async () => {
    signedIn();
    server.use(
      http.get(apiUrl("/roles"), () =>
        HttpResponse.json([aRole({ id: "role-1", name: "Gerente", permissions: ["ACCESS_READ"] })]),
      ),
    );

    renderWithProviders(<RolesListPage />);

    expect(await screen.findByText("Gerente")).toBeInTheDocument();
    expect(screen.getByText("Ver usuários e papéis")).toBeInTheDocument();
  });

  it("says the list is empty instead of showing a bare table", async () => {
    signedIn();
    server.use(http.get(apiUrl("/roles"), () => HttpResponse.json([])));

    renderWithProviders(<RolesListPage />);

    expect(await screen.findByText("Nenhum papel cadastrado ainda.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    signedIn();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/roles"), () => {
        attempts += 1;
        return attempts === 1
          ? new HttpResponse(null, { status: 502 })
          : HttpResponse.json([aRole({ name: "Gerente" })]);
      }),
    );

    renderWithProviders(<RolesListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Gerente")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/roles/RolesListPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/roles/RolesListPage"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/features/roles/RolesListPage.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchRoles, rolesKeys } from "@/features/roles/roles.api";
import { labelFor } from "@/lib/permissions";

export function RolesListPage() {
  const roles = useQuery({ queryKey: rolesKeys.all, queryFn: fetchRoles });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Papéis</h1>

      {roles.isPending ? <p>Carregando…</p> : null}

      {roles.isError ? <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} /> : null}

      {roles.isSuccess && roles.data.length === 0 ? <p>Nenhum papel cadastrado ainda.</p> : null}

      {roles.isSuccess && roles.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.data.map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                      <Badge key={permission} variant="secondary">
                        {labelFor(permission)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Montar a rota atrás da permissão**

Em `src/app/router.tsx`, adicione as importações e o ramo guardado dentro dos filhos do `AppShell`:

```tsx
import { RequirePermission } from "@/features/auth/RequirePermission";
import { RolesListPage } from "@/features/roles/RolesListPage";
```

```tsx
children: [
  { path: "/", element: <HomePage /> },
  { path: "/change-password", element: <ChangePasswordPage /> },
  {
    element: <RequirePermission permission="ACCESS_READ" />,
    children: [{ path: "/roles", element: <RolesListPage /> }],
  },
],
```

- [ ] **Step 5: Rodar o teste e confirmar o verde**

Run: `npm test -- src/features/roles/RolesListPage.test.tsx && npm run typecheck`
Expected: PASS, 3 testes.

- [ ] **Step 6: Commit**

```bash
git add src/features/roles src/app/router.tsx
git commit -m "feat(web): list roles with their permissions"
```

---

## Task 15: Criar e editar um papel

**Files:**

- Create: `src/features/roles/RoleDialog.tsx`
- Modify: `src/features/roles/RolesListPage.tsx`
- Test: `src/features/roles/RoleDialog.test.tsx`

**Interfaces:**

- Consumes: `createRole`, `updateRole`, `rolesKeys`; `PERMISSION_GROUPS`, `labelFor`; `messageForError`; `Dialog`, `Checkbox`, `Input`, `Label`, `Button`.
- Produces: `RoleDialog({ role, open, onOpenChange }: { role: Role | null; open: boolean; onOpenChange: (open: boolean) => void })`. `role` nulo significa criação.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/roles/RoleDialog.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleDialog } from "@/features/roles/RoleDialog";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aRole } from "@/tests/samples";

describe("RoleDialog", () => {
  it("refuses to submit a role with no name and no permission", async () => {
    renderWithProviders(<RoleDialog role={null} open onOpenChange={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome do papel.")).toBeInTheDocument();
    expect(screen.getByText("Escolha ao menos uma permissão.")).toBeInTheDocument();
  });

  it("creates a role with the chosen permissions and closes", async () => {
    const onOpenChange = vi.fn();
    let received: unknown = null;
    server.use(
      http.post(apiUrl("/roles"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole(), { status: 201 });
      }),
    );

    renderWithProviders(<RoleDialog role={null} open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Produção");
    await userEvent.click(screen.getByRole("checkbox", { name: "Registrar produção" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(received).toEqual({ name: "Produção", permissions: ["PRODUCTION_CREATE"] }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens already filled when editing, and sends the change", async () => {
    let received: unknown = null;
    server.use(
      http.patch(apiUrl("/roles/role-1"), async ({ request: incoming }) => {
        received = await incoming.json();
        return HttpResponse.json(aRole({ id: "role-1", name: "Gerência" }));
      }),
    );

    renderWithProviders(
      <RoleDialog
        role={aRole({ id: "role-1", name: "Gerente", permissions: ["ACCESS_READ"] })}
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Gerente");
    expect(screen.getByRole("checkbox", { name: "Ver usuários e papéis" })).toBeChecked();

    await userEvent.clear(screen.getByLabelText("Nome"));
    await userEvent.type(screen.getByLabelText("Nome"), "Gerência");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(received).toEqual({ name: "Gerência", permissions: ["ACCESS_READ"] }));
  });

  it("says the name is taken, in Portuguese, and keeps the dialog open", async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.post(apiUrl("/roles"), () =>
        HttpResponse.json({ message: "A role with this name already exists." }, { status: 409 }),
      ),
    );

    renderWithProviders(<RoleDialog role={null} open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Nome"), "Gerente");
    await userEvent.click(screen.getByRole("checkbox", { name: "Ver usuários e papéis" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um papel com esse nome.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/roles/RoleDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/roles/RoleDialog"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/features/roles/RoleDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRole, rolesKeys, updateRole } from "@/features/roles/roles.api";
import type { Permission, Role } from "@/lib/api";
import { messageForError } from "@/lib/form-errors";
import { labelFor, PERMISSION_GROUPS, PERMISSIONS } from "@/lib/permissions";

const roleFormSchema = z.object({
  name: z.string().min(1, "Informe o nome do papel.").max(60, "O nome pode ter no máximo 60 caracteres."),
  permissions: z.array(z.enum(PERMISSIONS)).min(1, "Escolha ao menos uma permissão."),
});

type RoleForm = z.infer<typeof roleFormSchema>;

const SAVE_MESSAGES = {
  409: "Já existe um papel com esse nome.",
  404: "Esse papel já não existe mais. Atualize a lista.",
};

interface RoleDialogProps {
  role: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleDialog({ role, open, onOpenChange }: RoleDialogProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<RoleForm>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: role?.name ?? "", permissions: role?.permissions ?? [] },
  });

  // Reopening the dialog for a different role must not show the previous one's
  // values; the form is only constructed once.
  useEffect(() => {
    form.reset({ name: role?.name ?? "", permissions: role?.permissions ?? [] });
    setFailure(null);
  }, [form, role, open]);

  const selected = form.watch("permissions");

  const save = useMutation({
    mutationFn: (values: RoleForm) => (role === null ? createRole(values) : updateRole(role.id, values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      toast.success(role === null ? "Papel criado." : "Papel salvo.");
      onOpenChange(false);
    },
    onError: (error: unknown) => setFailure(messageForError(error, SAVE_MESSAGES)),
  });

  function toggle(permission: Permission, checked: boolean): void {
    const next = checked ? [...selected, permission] : selected.filter((item) => item !== permission);

    form.setValue("permissions", next, { shouldValidate: form.formState.isSubmitted });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role === null ? "Novo papel" : "Editar papel"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((values) => {
            setFailure(null);
            save.mutate(values);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="role-name">Nome</Label>
            <Input id="role-name" autoFocus {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-medium">Permissões</legend>

            {PERMISSION_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{group.title}</p>

                {group.permissions.map((permission) => (
                  <div key={permission} className="flex items-center gap-2">
                    <Checkbox
                      id={`permission-${permission}`}
                      checked={selected.includes(permission)}
                      onCheckedChange={(checked) => toggle(permission, checked === true)}
                    />
                    <Label htmlFor={`permission-${permission}`}>{labelFor(permission)}</Label>
                  </div>
                ))}
              </div>
            ))}

            {form.formState.errors.permissions ? (
              <p className="text-sm text-destructive">{form.formState.errors.permissions.message}</p>
            ) : null}
          </fieldset>

          {failure !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Ligar o diálogo à lista**

Em `src/features/roles/RolesListPage.tsx`, acrescente o estado do diálogo, o botão de criação e o de edição por linha. As permissões de escrita vêm da sessão, para não oferecer um botão que responderia `403`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleDialog } from "@/features/roles/RoleDialog";
import { useSession } from "@/features/auth/use-session";
import type { Role } from "@/lib/api";
```

Dentro do componente, antes do `return`:

```tsx
const { can } = useSession();
const [editing, setEditing] = useState<Role | null>(null);
const [dialogOpen, setDialogOpen] = useState(false);

function openFor(role: Role | null): void {
  setEditing(role);
  setDialogOpen(true);
}
```

No cabeçalho da tela, ao lado do título:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-xl font-semibold">Papéis</h1>
  {can("ACCESS_CREATE") ? (
    <Button type="button" onClick={() => openFor(null)}>
      Novo papel
    </Button>
  ) : null}
</div>
```

Uma coluna a mais na tabela, com o cabeçalho `<TableHead>Ações</TableHead>` e, em cada linha:

```tsx
<TableCell>
  {can("ACCESS_UPDATE") ? (
    <Button type="button" variant="outline" onClick={() => openFor(role)}>
      Editar
    </Button>
  ) : null}
</TableCell>
```

E, ao final do componente, dentro do `<div>` externo:

```tsx
<RoleDialog role={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
```

- [ ] **Step 5: Rodar os testes e confirmar o verde**

Run: `npm test -- src/features/roles && npm run typecheck`
Expected: PASS. Os testes da lista continuam passando: o usuário deles tem `ACCESS_CREATE` e `ACCESS_UPDATE`.

- [ ] **Step 6: Commit**

```bash
git add src/features/roles
git commit -m "feat(web): create and edit a role with its permission set"
```

---

## Task 16: Excluir um papel

**Files:**

- Create: `src/features/roles/DeleteRoleDialog.tsx`
- Modify: `src/features/roles/RolesListPage.tsx`
- Test: `src/features/roles/DeleteRoleDialog.test.tsx`

**Interfaces:**

- Consumes: `deleteRole`, `rolesKeys`; `messageForError`; `AlertDialog`.
- Produces: `DeleteRoleDialog({ role, onOpenChange }: { role: Role | null; onOpenChange: (open: boolean) => void })`. `role` nulo mantém o diálogo fechado.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/roles/DeleteRoleDialog.test.tsx`:

```tsx
import { HttpResponse, http } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteRoleDialog } from "@/features/roles/DeleteRoleDialog";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { aRole } from "@/tests/samples";

describe("DeleteRoleDialog", () => {
  it("names the role and warns what deleting it costs", () => {
    renderWithProviders(<DeleteRoleDialog role={aRole({ name: "Gerente" })} onOpenChange={() => undefined} />);

    expect(screen.getByText('Excluir o papel "Gerente"?')).toBeInTheDocument();
    expect(
      screen.getByText("Quem tiver esse papel fica sem as permissões que ele dava. Não dá para desfazer."),
    ).toBeInTheDocument();
  });

  it("deletes on confirmation and closes", async () => {
    const onOpenChange = vi.fn();
    let called = false;
    server.use(
      http.delete(apiUrl("/roles/role-1"), () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<DeleteRoleDialog role={aRole({ id: "role-1" })} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(called).toBe(true));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("treats a role someone else already deleted as done, not as a failure", async () => {
    const onOpenChange = vi.fn();
    server.use(
      http.delete(apiUrl("/roles/role-1"), () => HttpResponse.json({ message: "Role not found." }, { status: 404 })),
    );

    renderWithProviders(<DeleteRoleDialog role={aRole({ id: "role-1" })} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the dialog open and explains when the server is at fault", async () => {
    const onOpenChange = vi.fn();
    server.use(http.delete(apiUrl("/roles/role-1"), () => new HttpResponse(null, { status: 502 })));

    renderWithProviders(<DeleteRoleDialog role={aRole({ id: "role-1" })} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir a operação.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar o vermelho**

Run: `npm test -- src/features/roles/DeleteRoleDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/roles/DeleteRoleDialog"`.

- [ ] **Step 3: Escrever a implementação mínima**

`src/features/roles/DeleteRoleDialog.tsx`:

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { deleteRole, rolesKeys } from "@/features/roles/roles.api";
import type { Role } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { messageForError } from "@/lib/form-errors";

interface DeleteRoleDialogProps {
  role: Role | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({ role, onOpenChange }: DeleteRoleDialogProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      toast.success("Papel excluído.");
      onOpenChange(false);
    },
    onError: async (error: unknown) => {
      // Someone else deleted it first. The operator asked for it gone and it is
      // gone: that is the outcome they wanted, not an error to explain.
      if (error instanceof ApiError && error.status === 404) {
        await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
        toast.success("Esse papel já havia sido excluído.");
        onOpenChange(false);
        return;
      }

      setFailure(messageForError(error));
    },
  });

  return (
    <AlertDialog
      open={role !== null}
      onOpenChange={(open) => {
        if (!open) setFailure(null);
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Excluir o papel "${role?.name ?? ""}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            Quem tiver esse papel fica sem as permissões que ele dava. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failure !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // The dialog would close on its own; the outcome has to decide that.
              event.preventDefault();
              setFailure(null);
              if (role !== null) remove.mutate(role.id);
            }}
            disabled={remove.isPending}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Ligar a exclusão à lista**

Em `src/features/roles/RolesListPage.tsx`:

```tsx
import { DeleteRoleDialog } from "@/features/roles/DeleteRoleDialog";
```

```tsx
const [deleting, setDeleting] = useState<Role | null>(null);
```

Na coluna de ações, ao lado do botão de editar:

```tsx
{
  can("ACCESS_UPDATE") ? (
    <Button type="button" variant="outline" onClick={() => setDeleting(role)}>
      Excluir
    </Button>
  ) : null;
}
```

E, junto do `RoleDialog`:

```tsx
<DeleteRoleDialog role={deleting} onOpenChange={(open) => setDeleting(open ? deleting : null)} />
```

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test && npm run typecheck && npm run build && npm run lint:prettier:check`
Expected: PASS em tudo.

- [ ] **Step 6: Commit**

```bash
git add src/features/roles
git commit -m "feat(web): delete a role behind a confirmation"
```

---

## Fechamento da fatia

- [ ] **Verificação final**

Run: `npm test && npm run typecheck && npm run build && npm run lint:prettier:check`
Expected: suíte inteira verde, sem erro de tipo, build gerado, formatação em dia. Cole a saída — sem ela, nenhuma afirmação de pronto.

- [ ] **Conferência manual, com a API no ar**

Com o `wa-api` rodando (`npm run services:up && npm run dev` naquele repositório) e o `wa-web` em `npm run dev`:

1. Entrar com um usuário que tenha `ACCESS_READ`, `ACCESS_CREATE` e `ACCESS_UPDATE`.
2. Recarregar a página com F5 — a sessão sobrevive, e a aba de rede mostra **uma** chamada a `/sessions/refresh`.
3. Abrir a aplicação em duas abas e recarregar as duas ao mesmo tempo — nenhuma delas cai para o login. Este é o teste que prova a trava; se falhar, confira se o endereço é `localhost` ou HTTPS, porque em HTTP puro `navigator.locks` não existe.
4. Criar um papel, editar seu nome, tentar criar outro com o mesmo nome (deve dizer que já existe) e excluir.
5. Entrar com um usuário sem `ACCESS_READ` — o menu não mostra "Papéis", e abrir `/roles` na barra de endereço mostra a tela de acesso negado, sem chamada a `/roles` na aba de rede.
6. Trocar a própria senha — a sessão termina e a tela volta ao login.

- [ ] **Abrir o PR** (somente sob ordem explícita do dono do projeto)

```
## What changed
- project scaffold with Vite, TypeScript and Vitest — the foundation every slice builds on
- environment module validated with Zod — a missing API base url fails at boot, not at the first request
- API contract types generated from the wa-api OpenAPI document — a contract change breaks the build
- HTTP client with a single-flight refresh under a cross-tab lock — stops the API's chain revocation from logging operators out
- session context rehydrated from the stored refresh token — the session survives a reload
- route guards for authentication and permission — a denied screen never mounts nor calls the API
- application shell with a permission-filtered menu — no button that would answer 403
- sign-in and change-password screens — the password change ends the session the API revoked
- roles CRUD with permission selection and delete confirmation — the slice that proves the foundation

## Dependencies
- react@19.2.8, react-dom@19.2.8 — view layer
- vite@8.2.2, @vitejs/plugin-react@6.1.1 — build and dev server
- typescript@6.0.3 — type checking; 7.x breaks openapi-typescript, which calls the compiler API its Go rewrite removed
- @tanstack/react-query@5.102.8 — server state ownership
- react-router-dom@7.18.3 — routing and route guards
- react-hook-form@7.86.0, @hookform/resolvers@5.9.1, zod@4.5.4 — forms and validation
- tailwindcss@4.3.3, @tailwindcss/vite@4.3.3 — styling
- @base-ui/react@1.7.0, class-variance-authority@0.7.1, clsx@2.1.1, tailwind-merge@3.6.0, lucide-react@1.37.0, sonner@2.0.8 — component vocabulary
- vitest@4.1.11, jsdom@30.0.1, @testing-library/react@16.3.3, @testing-library/user-event@14.6.6, @testing-library/jest-dom@7.0.1, msw@2.15.0 — test suite
- openapi-typescript@7.13.0 — contract type generation
- prettier@3.9.6, husky@9.1.7, @commitlint/cli@21.2.2, @commitlint/config-conventional@21.2.2 — formatting and commit conventions
```

## Riscos de execução deste plano

- **A Task 8 depende de uma ferramenta externa interativa.** Se o `shadcn` mudar de opções, o objetivo permanece: `components.json` apontando para `src/index.css` e os apelidos `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, mais os componentes listados sob `src/components/ui/`. O restante do plano só depende dos nomes exportados.
- **A Task 2 depende da forma exata do documento gerado.** Se um apelido de `src/lib/api.ts` resolver para `never`, o erro aparece em `src/tests/samples.ts`; conserte o caminho indexado em `api.ts` conferindo o nome da rota em `../wa-api/openapi.json`, e nunca editando `api.types.ts`.
- **`navigator.locks` não existe em jsdom.** Os testes do `refresh-lock` cobrem os dois caminhos justamente por isso; os testes do `http` rodam pelo caminho da fila interna à aba, que é o que jsdom oferece. A serialização entre abas só se verifica na conferência manual.
