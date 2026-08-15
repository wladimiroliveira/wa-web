# Fundação e Autenticação do wa-web — Design

Data: 2026-08-15
Repositório: `wa-web`, vazio até aqui
API consumida: `wa-api` no commit `e1d3458` (33 rotas, todas com schema de resposta)

## Problema

A wa-api está pronta e documentada, mas ninguém a usa: o único cliente hoje é o Swagger UI. O wa-system precisa de
interface, e a interface precisa antes de uma fundação que não existe — projeto, camada HTTP, sessão, portão de
permissão e design system.

Essa fundação não é trabalho de infraestrutura que se resolve no caminho. O back end impõe uma restrição que, ignorada,
quebra o produto de um jeito difícil de diagnosticar: **o refresh token rotaciona a cada uso, e replay de um token já
rotacionado revoga a sessão inteira**, porque o back end lê a repetição como roubo. Duas requisições simultâneas
tomando `401`, ou duas abas abertas na mesma conta, derrubam a pessoa para o login sem explicação. Serializar a rotação
é o problema central desta fatia; o resto é consequência.

## Fatiamento

O front end inteiro são cinco fatias independentes. Este documento cobre a primeira; cada uma das seguintes ganha o seu
próprio design e o seu próprio plano.

| # | Fatia                   | Conteúdo                                                              |
| - | ----------------------- | --------------------------------------------------------------------- |
| 1 | **Fundação e auth**     | Projeto, camada HTTP, sessão, portão de permissão, shell, design system |
| 2 | Insumos e estoque       | CRUD de insumos, entrada de estoque, razão de movimentações            |
| 3 | Receitas e precificação | Ficha técnica, itens, margem, custo e preço sugerido                   |
| 4 | Produção e perdas       | Registro de produção com avisos de saldo negativo, registro de perdas  |
| 5 | Usuários e papéis       | CRUD de usuários, papéis, exceções e permissão efetiva                 |

Nenhuma tela de domínio entra na fatia 1. O que entra são as seis entradas de menu apontando para uma página "em
construção", porque o portão de permissão precisa ser exercitado de verdade para valer alguma coisa — um guarda sem
nada para guardar não é testável.

## Decisões de desenho

| Decisão                      | Escolha                                     | Por quê                                                                                       |
| ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Arquitetura                  | SPA React + Vite                            | A API entrega tokens no corpo e já libera `localhost:5173` no CORS; SSR só traria a pergunta de onde o token vive |
| Fonte da sessão              | `GET /me` como query do TanStack Query      | Uma cópia só do estado de sessão; as permissões efetivas já vêm calculadas pelo back end       |
| Rotação do refresh           | Serializada com Web Locks, entre abas       | Fila em memória protege dentro da aba e falha entre abas, que é justamente onde o replay ocorre |
| Contratos                    | Tipos gerados do OpenAPI, versionados       | 33 contratos escritos à mão sofrem drift silencioso; o documento já é executável no back end   |
| Camada HTTP                  | Wrapper próprio, sem cliente de terceiro    | O `401 → refresh → repete` é delicado demais para depender do modelo de middleware de uma lib  |
| Camada visual                | Tailwind + shadcn/ui copiado para o repo    | Identidade própria sem depender do tema de terceiro; o código dos componentes é nosso          |
| Identidade                   | Ferramenta de trabalho, sóbria              | Uso diário e leitura rápida de número; cor só onde significa alguma coisa                      |
| Alvo                         | Desktop primeiro, celular funciona          | O uso real é sentado, cadastrando insumo e conferindo preço                                    |

## Stack

| Papel               | Escolha                          |
| ------------------- | -------------------------------- |
| Build               | Vite                             |
| UI                  | React 19, TypeScript estrito     |
| Rotas               | React Router v7                  |
| Estado de servidor  | TanStack Query v5                |
| Formulários         | react-hook-form + Zod            |
| Estilo              | Tailwind v4                      |
| Componentes         | shadcn/ui (copiados para o repo) |
| Tipos da API        | openapi-typescript (dev)         |
| Testes              | Vitest, Testing Library, MSW     |
| Formatação          | Prettier, 120 colunas, aspas duplas |
| Commits             | Husky + commitlint, Conventional Commits |

Versões exatas são fixadas na instalação e registradas no PR; o que este documento fixa são as escolhas.

## Estrutura do projeto

Espelha a organização por módulo do wa-api, para quem troca de repositório achar a mesma coisa no mesmo lugar.

```
src/
  main.tsx
  app/
    providers.tsx        # QueryClient, RouterProvider, Toaster
    router.tsx           # árvore de rotas e guardas
  lib/
    env.ts               # VITE_API_URL validado com Zod no boot
    api.types.ts         # GERADO do OpenAPI — não editar à mão
    tokens.ts            # access em memória, refresh em localStorage
    refresh-lock.ts      # serialização da rotação
    http.ts              # bearer, 401→refresh→repete, ApiError
    query.ts             # configuração do QueryClient
    format.ts            # dinheiro e quantidade em pt-BR
  features/
    auth/
      auth.api.ts        # /sessions, /sessions/refresh, DELETE /sessions, /me
      permission.ts      # união Permission e helpers
      use-session.ts     # useQuery(["me"]) — é a sessão
      use-login.ts
      use-logout.ts
      RequireSession.tsx
      RequirePermission.tsx
      LoginPage.tsx
    home/
      HomePage.tsx
  components/
    ui/                  # shadcn
    layout/              # AppShell, Sidebar, Topbar
```

## Contratos

O documento OpenAPI é servido em `/docs/json`, e `/docs` está na lista de prefixos públicos do `auth.plugin`, então a
geração não precisa de token.

`npm run api:types` roda `openapi-typescript` contra `http://localhost:3333/docs/json` e escreve `src/lib/api.types.ts`.
**O arquivo gerado é versionado.** Build e CI nunca dependem da wa-api estar de pé; só quem mexe no contrato roda o
script. Um `openapi.json` exportado por script no próprio wa-api seria mais robusto — o documento deixaria de precisar
de um servidor rodando para existir —, mas isso é mudança no outro repositório e fica registrado aqui como sugestão,
fora do escopo desta fatia.

Não há validação Zod das respostas em runtime. O `serializerCompiler` do back end já remove campo não declarado e
recusa campo obrigatório ausente: a forma do corpo é garantida na origem, e repetir a checagem no cliente seria custo
sem retorno. Zod fica onde ainda faz diferença — validando o que a pessoa digita, nos formulários.

O documento gera os schemas **inline**, dentro de cada operação — não há `components.schemas` nomeado, porque o
`jsonSchemaTransform` do `fastify-type-provider-zod` não extrai schema compartilhado. Verificado contra o documento real
em `/docs/json`. Isso decide como os tipos são derivados: a partir de `paths`, nunca de um nome de componente.

`Permission` sai da própria resposta de `/me`, não é redigitada:

```ts
type MeResponse = paths["/me"]["get"]["responses"][200]["content"]["application/json"];

export type Permission = MeResponse["permissions"][number]; // a união das 13 permissões
```

`features/auth/permission.ts` reexporta esse tipo e é o único lugar do front end que sabe onde ele mora. Se o contrato
mudar, o `tsc` acusa em um arquivo, não em quinze.

### O que mudou no contrato e afeta o front end

O commit `e1d3458` do wa-api converteu todo decimal de string para `number` na borda HTTP. Duas consequências diretas:

- **Formatar é trabalho do front end.** `GET /recipes/:id/pricing` perdeu o `toFixed(2)`: chega `12.5`, não `"12.50"`.
  `lib/format.ts` existe por causa disso.
- **`exactPrice` não é mais exato no transporte.** O cálculo permanece exato em `Prisma.Decimal` dentro da API; o valor
  que trafega é um `number` de JavaScript. Para exibição isso é irrelevante, e nenhuma tela desta fatia usa o campo.
  Fica registrado para as fatias 3 e 4 não construírem aritmética em cima dele.

## Sessão

### Onde cada token vive

Access token numa variável de módulo, some ao recarregar a página. Refresh token em `localStorage`, sob a chave
`wa.refresh`.

Não é escolha estética. A API devolve os dois tokens no corpo da resposta, não em cookie `httpOnly`, então cookie não
está disponível sem mudar o back end. E um refresh de 30 dias que morre a cada F5 desperdiça exatamente o que o back
end construiu. O risco está na seção de riscos assumidos, escrito, não escondido.

### O interceptor

`http.ts` anexa `Authorization: Bearer <access>` quando há token. Em `401`, chama `ensureFreshAccessToken()` e repete a
requisição **uma única vez**. Um segundo `401` derruba a sessão. `POST /sessions` e `POST /sessions/refresh` ficam fora
desse tratamento, senão o refresh que falha chama a si mesmo.

Todo erro vira `ApiError`, com `status`, `message` e `code` opcional, normalizando as três formas do `errorSchema`.

### A rotação

O ponto delicado da fatia. `ensureFreshAccessToken` roda inteiro dentro de um lock nomeado, e faz duas coisas dentro
dele que não podem ser feitas fora:

```ts
async function ensureFreshAccessToken(staleToken: string | null): Promise<string> {
  return withRefreshLock(async () => {
    // Alguém — outra requisição desta aba, ou outra aba — pode ter rotacionado
    // enquanto esperávamos o lock. Se rotacionou, o trabalho já está feito.
    const current = getAccessToken();
    if (current && current !== staleToken) return current;

    // Relê do storage DENTRO do lock: a outra aba já gravou o token novo aqui.
    // Ler antes do lock usaria o token velho e o back end trataria como replay.
    const refresh = getRefreshToken();
    if (!refresh) throw new SessionExpiredError();

    const pair = await postRefresh(refresh);
    setRefreshToken(pair.refreshToken);
    setAccessToken(pair.accessToken);
    return pair.accessToken;
  });
}
```

`withRefreshLock` usa `navigator.locks.request("wa.refresh", fn)`, que serializa **entre abas do mesmo origin** — que é
onde uma fila em memória falharia. O lock garante que a releitura do storage seja confiável; a releitura é o que
impede o replay. Os dois juntos, não um dos dois.

Sem `navigator.locks` disponível, cai para uma promessa única de módulo: continua serializando dentro da aba, deixa de
serializar entre abas. É degradação conhecida e documentada, não silenciosa.

Um listener de `storage` cobre um caso que o lock não cobre: **logout em outra aba**. Quando `wa.refresh` é removido,
esta aba limpa o cache e vai para o login. Rotação em outra aba não exige reação nenhuma — o access token desta aba
continua válido até expirar por conta própria, e quando expirar o interceptor resolve.

### Ciclo de vida

- **Boot.** Sem refresh token no storage, vai direto para o login, sem gastar requisição. Com token, chama `/me` e
  deixa o interceptor cuidar do `401`.
- **Login.** `POST /sessions` → grava os dois tokens → invalida `["me"]` → volta para a rota que a pessoa tentou abrir.
- **Logout.** `DELETE /sessions` com o refresh no corpo → limpa tokens → `queryClient.clear()` → login. Falha de rede
  no `DELETE` não impede a limpeza local: sair tem que sair.

A sessão é `useQuery(["me"])` com `staleTime: Infinity`, `retry: false` e sem refetch ao focar a janela. Resolveu,
está logado, e `permissions` vem junto. Não existe segunda cópia desse estado em lugar nenhum.

## Rotas e permissão

`createBrowserRouter`. `/login` é a única rota pública; todo o resto fica sob `<RequireSession>`, que renderiza o shell
e segura a árvore enquanto `/me` não resolve.

`<RequirePermission permission="SUPPLIES_READ">` faz o portão por módulo. Sem a permissão, a pessoa vê **uma tela de
403**, não um redirect para o login: a distinção que o back end faz entre "não sei quem é você" e "sei, e você não
pode" chega intacta na tela.

O menu lateral sai de um único array `NAV_ITEMS`, onde cada item declara a permissão que exige. Item sem permissão não
é renderizado. Nesta fatia os seis itens apontam para uma página "em construção".

| Rota          | Permissão exigida  |
| ------------- | ------------------ |
| `/`           | nenhuma            |
| `/supplies`   | `SUPPLIES_READ`    |
| `/recipes`    | `RECIPES_READ`     |
| `/stock`      | `STOCK_READ`       |
| `/productions`| `PRODUCTION_READ`  |
| `/wastes`     | `WASTE_READ`       |
| `/users`      | `USERS_READ`       |

## Camada visual

Tailwind v4 e shadcn/ui com os componentes copiados para `components/ui/`. Base neutra, **uma** cor de destaque, e cor
semântica reservada para quando significa alguma coisa — o aviso de saldo negativo do `POST /productions` é o caso que
já existe e que justifica a regra.

Densidade compacta e numerais tabulares em toda coluna de número, para dinheiro e quantidade alinharem na vertical.
Os tokens de tema escuro do shadcn ficam definidos; a chave para trocar fica fora desta fatia.

`lib/format.ts` nasce aqui, mesmo sem tela de domínio, porque é contrato: `formatCurrency` e `formatQuantity` em pt-BR
via `Intl.NumberFormat`, recebendo `number`.

Textos de interface em português; identificadores, arquivos, testes e comentários em inglês.

## Tratamento de erro

As mensagens da API já vêm em português. A regra é **mostrar a `message` da API quando existir**, caindo para texto
genérico só quando não existir.

| Situação            | Comportamento                                              |
| ------------------- | ---------------------------------------------------------- |
| `401`               | Limpa a sessão, vai para o login                           |
| `403`               | Tela de acesso negado, sem redirect                        |
| `429` no login      | Mensagem de espera, não "credencial inválida"              |
| `4xx` de formulário | Erro inline no campo                                       |
| `5xx` e falha de rede | `errorElement` da rota, com botão de tentar de novo      |

Erro de mutação aparece em toast. Erro de carregamento aparece na região que falhou, não em toast.

O `429` merece destaque porque é fácil de esquecer: `POST /sessions` tem rate limit de 5 tentativas por 15 minutos por
endereço, e repetir "credencial inválida" nesse caso faz a pessoa tentar de novo e piorar a própria situação.

## Ambiente e scripts

`VITE_API_URL` é validado com Zod no boot. Ausente ou inválida, o app para com mensagem clara, em vez de virar
`fetch("undefined/sessions")`. `.example.env` versionado.

| Script                        | O que faz                                    |
| ----------------------------- | -------------------------------------------- |
| `npm run dev`                 | Vite em modo desenvolvimento                 |
| `npm run build`               | Typecheck e build de produção                |
| `npm run preview`             | Serve o build                                |
| `npm test`                    | Vitest uma vez                               |
| `npm run test:watch`          | Vitest em watch                              |
| `npm run api:types`           | Regenera `src/lib/api.types.ts` do OpenAPI   |
| `npm run lint:prettier:check` | Confere formatação                           |
| `npm run lint:prettier:fix`   | Corrige formatação                           |

## Testes

TDD. Cada item abaixo nasce vermelho antes de existir implementação. MSW serve a API, então nada disso precisa de back
end de pé.

1. `tokens` — grava, lê e limpa; o access token nunca toca o `localStorage`
2. `http` — anexa o bearer quando há token e não anexa quando não há
3. `http` — `401` dispara refresh e repete a requisição uma vez; um segundo `401` limpa a sessão
4. `http` — `/sessions` e `/sessions/refresh` não passam pelo interceptor
5. **`http` — N requisições simultâneas em `401` disparam exatamente um `POST /sessions/refresh`**
6. `refresh-lock` — com token novo já no storage ao entrar no lock, não chama a API
7. `refresh-lock` — sem `navigator.locks`, continua serializando dentro da aba
8. `refresh-lock` — o refresh token é relido de dentro do lock, não capturado antes dele
9. `boot` — sem refresh token no storage, `/me` não é chamado
10. `login` — credencial errada mostra a mensagem da API
11. `login` — `429` mostra a mensagem de espera, distinta da de credencial inválida
12. `login` — sucesso volta para a rota que a pessoa tentou abrir, não para a home
13. `logout` — falha de rede no `DELETE /sessions` ainda limpa tokens e cache
14. `RequirePermission` — com a permissão renderiza; sem ela mostra 403, não o login
15. `NAV_ITEMS` — item sem a permissão não aparece no menu
16. `env` — `VITE_API_URL` ausente derruba o boot com mensagem clara

O teste 5 é o que justifica esta fatia existir como fatia.

## Riscos assumidos

- **Refresh token em `localStorage` é alcançável por XSS.** Aceito porque a API não oferece cookie `httpOnly` e a
  alternativa — sessão que morre a cada recarga — desperdiça o refresh de 30 dias. Mitigação disponível hoje: nenhuma
  renderização de HTML vindo de dado, e dependências mantidas atualizadas. Mitigação real exigiria mudança no back end.
- **Sem `navigator.locks`, a serialização entre abas cai.** Navegadores atuais têm a API; o fallback existe para não
  quebrar em ambiente exótico, com a limitação registrada.
- **`api.types.ts` gerado pode envelhecer** se alguém mudar o contrato no wa-api e não rodar `api:types`. O sintoma é
  silencioso: o tsc continua passando contra o tipo velho.

## Fora de escopo

- Todas as telas de domínio (fatias 2 a 5)
- Administração de usuários e papéis
- Troca de senha — **não existe endpoint na API**
- Paginação, busca e ordenação — a API não oferece
- i18n, tema escuro, PWA e offline
- Pipeline de CI do wa-web

## Achados no wa-api

Fora do escopo desta fatia. Todos registrados como issue no outro repositório:

| # | Achado | Issue |
| - | ------ | ----- |
| 1 | **Não há como trocar a senha.** `PATCH /users/:id` aceita nome, username, papel, exceções e `isActive`; senha só na criação. Ninguém troca a própria senha nem reseta a de outro, e a senha do Owner vinda de `OWNER_PASSWORD` é permanente. O mais sério | [#19](https://github.com/wladimiroliveira/wa-api/issues/19) |
| 2 | **Refresh token entregue no corpo**, o que força o front end a `localStorage`. Cookie `httpOnly` eliminaria o risco de XSS sobre a sessão | [#18](https://github.com/wladimiroliveira/wa-api/issues/18) |
| 3 | **Nenhuma listagem tem paginação.** As três de razão — `/supplies/:id/movements`, `/productions`, `/wastes` — são append-only e crescem sem teto | [#20](https://github.com/wladimiroliveira/wa-api/issues/20) |
| 4 | **`GET /productions` não traz o nome da receita**, e os `movements` dentro de `GET /productions/:id` não trazem o insumo. As fatias 2 e 4 teriam que cruzar no cliente | [#21](https://github.com/wladimiroliveira/wa-api/issues/21) |
| 5 | **O `openapi.json` só existe em runtime.** Exportá-lo por script e travar a divergência no CI tornaria a geração de tipos independente de servidor e faria mudança de contrato aparecer no diff do PR | [#22](https://github.com/wladimiroliveira/wa-api/issues/22) |

O achado 4 foi mais estreito do que parecia na primeira leitura: `GET /supplies/:id/movements` **não** precisa do insumo
aninhado, porque o insumo é o `:id` da própria URL, e `GET /wastes` já resolve o caso dele com `include: { supply: true }`.
O buraco é só no módulo de produção.

Nenhum deles bloqueia esta fatia. O achado 1 bloqueia colocar o sistema na mão de outra pessoa, e o achado 2, se for
aceito, muda a seção de riscos assumidos deste documento.
