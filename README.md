# wa-web

Front-end SPA (React 19 + Vite) do `wa-system`, consumindo a API Fastify em `wa-api`.

## Ambiente

Nenhum arquivo `.env` é versionado. Para desenvolver, copie o exemplo e aponte para a
sua API:

```bash
cp .example.env .env
```

`VITE_API_BASE_URL` já inclui o prefixo de versão (`http://localhost:3333/v1`), é lida
e validada num módulo só (`src/lib/env.ts`), e falha alto no boot se faltar ou vier sem
esquema — um endereço escrito como `localhost:3333` é recusado, não aceito em silêncio.

A suíte de testes não depende de arquivo nenhum: `vite.config.ts` declara o valor que
ela usa, então `npm test` funciona num clone recém-feito e no CI.

## Requisitos de implantação

Três decisões que a especificação trata como certas, mas que nenhum artefato do
repositório impõe. Sem elas o comportamento descrito na spec não se sustenta:

- **HTTPS.** `navigator.locks`, que serializa a rotação do refresh token entre abas,
  só existe em contexto seguro. Servir por HTTP simples faz a revogação em cadeia
  voltar — duas abas podem reenviar o mesmo token e derrubar a sessão do operador
  sem explicação.
- **Fallback de histórico no servidor estático.** O roteamento é todo client-side.
  Sem reescrever qualquer caminho desconhecido para `index.html`, um link direto
  para `/roles` (um bookmark, um recarregar de página) devolve 404 do host em vez
  de abrir a aplicação.
- **CSP.** O refresh token vive em `localStorage` porque a API o devolve no corpo
  da resposta, não em cookie `httpOnly`. Sem uma Content-Security-Policy restringindo
  origens de script, um XSS tem acesso direto a ele — é a mitigação que a spec cita
  e que não existe em lugar nenhum do repositório.
