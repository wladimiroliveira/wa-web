# wa-web

Aplicação do `wa-system`: front-end React 19 e API REST, no mesmo projeto Next.js (App Router),
pensado para um único deploy na Vercel.

## Ambiente

Nenhum arquivo `.env` é versionado. Para desenvolver, copie o exemplo:

```bash
cp .example.env .env
```

`NEXT_PUBLIC_API_BASE_URL` fica vazio por padrão: o front chama a API servida por esta mesma
aplicação em `/v1`. Só precisa de valor enquanto a API ainda rodar em outro lugar, e aí deve
vir com esquema (`http://localhost:3333/v1`); `localhost:3333` é recusado no boot, não aceito
em silêncio. A leitura e validação vivem num módulo só (`src/lib/env.ts`).

A suíte de testes não depende de arquivo nenhum: `vitest.config.ts` declara o valor que ela
usa, então `npm test` funciona num clone recém-feito e no CI.

## Scripts

| Comando             | O que faz                   |
| ------------------- | --------------------------- |
| `npm run dev`       | servidor de desenvolvimento |
| `npm run build`     | build de produção           |
| `npm test`          | testes                      |
| `npm run typecheck` | checagem de tipos           |

## Requisitos de implantação

- **HTTPS.** `navigator.locks`, que serializa a rotação do refresh token entre abas, só existe
  em contexto seguro. Servir por HTTP simples faz a revogação em cadeia voltar — duas abas podem
  reenviar o mesmo token e derrubar a sessão do operador sem explicação.
- **CSP.** O refresh token vive em `localStorage` porque a API o devolve no corpo da resposta,
  não em cookie `httpOnly`. Sem uma Content-Security-Policy restringindo origens de script, um
  XSS tem acesso direto a ele.
