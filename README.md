# wa-web

Aplicação do `wa-system`: front-end React 19 e API REST no mesmo projeto Next.js (App Router),
pensado para um único deploy na Vercel. Substitui o par `wa-web` + `wa-api`.

- O front vive em `src/app` (rotas) e `src/features` (telas).
- A API vive em `src/server` e é servida em `/v1/*` por um único route handler
  (`src/app/v1/[[...path]]/route.ts`), que despacha pela tabela de rotas em `src/server/routes.ts`.
  Cada rota declara uma vez seu caminho, regra de acesso, schemas zod e respostas; o despachante,
  os testes e o `openapi.json` leem a mesma declaração.
- O banco é Postgres via Prisma (`prisma/schema.prisma`, migrações em `prisma/migrations`).

## Ambiente

Nenhum arquivo `.env` é versionado. Para desenvolver, copie o exemplo e suba o Postgres:

```bash
cp .example.env .env
npm run services:up
npm run db:migrate:dev
npm run db:seed
npm run dev
```

`NEXT_PUBLIC_API_BASE_URL` fica vazio por padrão: o front chama a API desta mesma aplicação em
`/v1`. Só precisa de valor enquanto a API rodar em outro lugar, e aí deve vir com esquema
(`http://localhost:3333/v1`); `localhost:3333` é recusado no boot, não aceito em silêncio.

As variáveis do servidor (`DATABASE_URL`, `JWT_SECRET`, tempos de vida dos tokens) são validadas
em `src/server/lib/env.ts` na primeira requisição, não no build: o build da Vercel não precisa de
banco.

## Scripts

| Comando                    | O que faz                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `npm run dev`              | servidor de desenvolvimento (front e API)                     |
| `npm run build`            | build de produção                                             |
| `npm test`                 | testes do front (jsdom) e unitários da API                    |
| `npm run test:integration` | testes da API contra o Postgres (`TEST_DATABASE_URL`)         |
| `npm run test:all`         | tudo                                                          |
| `npm run typecheck`        | checagem de tipos                                             |
| `npm run db:migrate:dev`   | cria e aplica migrações no banco de desenvolvimento           |
| `npm run db:seed`          | cria o papel Owner e o primeiro usuário (`OWNER_*` no `.env`) |
| `npm run openapi:dump`     | regrava `openapi.json` a partir da tabela de rotas            |
| `npm run api:types`        | regenera `src/lib/api.types.ts` a partir de `openapi.json`    |

A suíte de testes não depende de arquivo nenhum para o front: `vitest.config.ts` declara a base
da API que ela usa. Os testes de integração precisam de `TEST_DATABASE_URL`; eles aplicam as
migrações nesse schema e truncam as tabelas entre os testes.

## Contrato da API

`openapi.json` é gerado, não escrito à mão, e é o que o app mobile (`swagger_parser`) e o
próprio front (`openapi-typescript`) usam para gerar seus clientes. Mudou uma rota: rode
`npm run openapi:dump && npm run api:types` e commite os dois arquivos. O documento também é
servido em `GET /v1/openapi.json`.

## Implantação

- **Vercel.** `postinstall` roda `prisma generate`; o schema declara o alvo
  `rhel-openssl-3.0.x`. As migrações não rodam no build: aplique-as com
  `npm run db:migrate:deploy` como passo de release, ou configure o comando de build como
  `npx prisma migrate deploy && next build`.
- **Postgres com pool.** Funções serverless abrem conexões por instância; use um banco com
  pooler (Neon, Supabase, PgBouncer) na `DATABASE_URL`.
- **Rate limit do login.** Vive na memória de cada instância, como no `wa-api`. É um freio a
  varreduras de senha, não uma garantia global.
- **HTTPS.** `navigator.locks`, que serializa a rotação do refresh token entre abas, só existe
  em contexto seguro.
- **CSP.** O refresh token vive em `localStorage` porque a API o devolve no corpo da resposta,
  não em cookie `httpOnly`. Sem uma Content-Security-Policy restringindo origens de script, um
  XSS tem acesso direto a ele.
