# Insumos e Estoque do wa-web — Design

Data: 2026-08-16
Fatia: 2 do fatiamento em [Fundação e Autenticação](2026-08-15-fundacao-autenticacao-design.md)
API consumida: `wa-api` no commit `3c1eb03`, rotas `/supplies`, `/supplies/:id`, `/supplies/:id/stock-entries`,
`/supplies/:id/movements`

## Problema

O wa-system tem hoje duas telas de administração e nenhuma de operação. A padaria cadastra pessoas e não cadastra
farinha. As três fatias restantes — receitas, produção e perdas — dependem todas de insumo existir: receita referencia
insumo, produção consome saldo, perda desconta saldo. Enquanto esta fatia não existir, as outras não têm do que partir.

O que a torna mais que um CRUD é a unidade. O back end guarda saldo e movimentação numa **unidade base** — grama para
peso, mililitro para volume, unidade para contagem — enquanto quem opera pensa no que comprou: um saco de 5 kg, um
frasco de 750 ml. Uma tela que mostre `12500` para um saldo de 12,5 kg está tecnicamente correta e inútil. Pior: a API
recusa entrada cuja unidade seja de outra dimensão que a do insumo, então um seletor de unidade ingênuo oferece caminhos
que só falham depois do envio.

Some-se um segundo detalhe que a geração de tipos escondeu: **o razão de movimentações passou a ser paginado por
cursor**, e o `src/lib/api.types.ts` versionado no wa-web ainda descreve a rota devolvendo um array. O tipo mente sobre
a rota central desta fatia.

## Decisões de desenho

| Decisão                | Escolha                                       | Por quê                                                                                    |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Fonte dos tipos        | `openapi.json` versionado do `wa-api`         | A API quebra o próprio build quando o contrato deriva; gerar sem servidor nem banco         |
| Cadastro e saldo       | Duas telas, `/supplies` e `/stock`            | São dois trabalhos e duas permissões; uma tabela só misturaria cadastro com operação        |
| Entrada de estoque     | Modal na lista de saldos                      | Chegou a nota, lança oito itens sem sair da lista; três campos cabem em modal               |
| Razão                  | Rota própria, `/stock/:id`                    | É leitura longa e paginada, e merece link direto                                            |
| Unidade na tela        | A unidade de compra do insumo                 | É a unidade em que a pessoa pensa, e cada insumo já carrega a sua em `purchaseUnit`         |
| Conversão              | Só na leitura                                 | A API recebe `quantity` + `unit` crus e converte com `Decimal`; o front nunca multiplica    |
| Fonte da lista de saldo| A mesma query de `/supplies`                  | As duas telas leem `GET /supplies`; duas queries dariam duas caches do mesmo dado           |
| Exclusão de insumo     | Botão sempre visível, `409` tratado           | Nada na resposta diz se há movimento; esconder o botão exigiria um dado que a API não dá    |
| Infraestrutura nova    | `select`, `dialog` e um módulo de unidade     | Os três se repetem dentro desta fatia; nada além disso                                      |

## Escopo

Entra: regeneração dos tipos da API, CRUD de insumos, lista de saldos, entrada de estoque, razão de movimentações
paginada por cursor.

Fora: perdas e produção — fatia 4, ainda que `POST /supplies/:id/wastes` seja uma rota de insumo; receitas e
precificação — fatia 3; busca e ordenação de insumos — `GET /supplies` não aceita parâmetro; filtro por data no razão —
a API só oferece em `/wastes`; estorno ou edição de movimentação — o razão é append-only e não há endpoint; ajuste
manual de saldo — `POST /supplies/:id/stock-entries` exige `quantity` positiva, então corrigir para baixo só existe
como perda, na fatia 4; tema escuro; `DataTable` genérica.

Fora também, e registrado aqui para não se perder: **a troca de senha deixou de ser impossível**. A fatia 5 a excluiu do
escopo porque a API não tinha endpoint, e o commit `41d976c` do `wa-api` acrescentou `PATCH /me/password` e
`PATCH /users/:id/password`. Isso virou dívida do módulo de usuários, não trabalho desta fatia.

## Os tipos defasados

`src/lib/api.types.ts` foi gerado quando o razão ainda devolvia um array e a API não tinha rota de senha. Desde então:

| Commit no `wa-api` | Mudança                                        | Efeito no wa-web                                                    |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------- |
| `ad80267`          | Razão paginado por cursor, filtrado por data   | `GET /supplies/:id/movements` devolve `{ data, nextCursor }`         |
| `4c77770`          | `recipe` e `supply` aninhados nas produções    | Fatia 4                                                             |
| `41d976c`          | Rotas de troca de senha                        | Dívida do módulo de usuários                                         |
| `4e4e32f`          | Contrato exportado para `openapi.json`         | Fonte de tipos que não exige servidor de pé                          |

O script muda de `http://localhost:3333/docs/json` para `../wa-api/openapi.json`. O caminho relativo assume os dois
repositórios lado a lado — é frágil para quem clonar só o wa-web, e é o preço de gerar contra um commit em vez de contra
o estado local de um servidor. O `7f833f4` faz o build do `wa-api` falhar quando o arquivo deriva do código, então o
arquivo é confiável.

Regenerar é o primeiro passo da implementação, antes de qualquer tela. Se o `tsc` quebrar em `features/users` ou
`features/roles`, o conserto entra junto: tipo que mente é dívida, não escopo novo.

## Rotas

| Rota            | Permissão        | Tela                          |
| --------------- | ---------------- | ----------------------------- |
| `/supplies`     | `SUPPLIES_READ`  | lista do cadastro             |
| `/supplies/new` | `SUPPLIES_WRITE` | criar                         |
| `/supplies/:id` | `SUPPLIES_WRITE` | editar                        |
| `/stock`        | `STOCK_READ`     | saldos, com entrada em modal  |
| `/stock/:id`    | `STOCK_READ`     | razão de movimentações        |

O menu não muda: `/supplies` e `/stock` já estão em `NAV_ITEMS` desde a fatia 1, com as permissões certas. O que muda é
`BUILT_ROUTES` em `router.tsx`, que perde duas entradas de placeholder — sobram `/recipes`, `/productions` e `/wastes`.

Uma ressalva. A entrada de estoque exige `STOCK_WRITE`, e mora num modal dentro de uma rota `STOCK_READ`. Modal não é
rota, então aqui não há portão de rota a erguer: o botão some para quem não tem `STOCK_WRITE`, e quem chamar a API
direto toma `403` do back end. É a mesma postura da fatia 5 — trava de tela não protege quem chama a API direto.

## Estrutura

```
src/features/supplies/        src/features/stock/           src/lib/
  supplies.api.ts               stock.api.ts                  unit.ts            (novo)
  use-supplies.ts               use-movements.ts
  use-supply.ts                 use-stock-mutations.ts      src/components/ui/
  use-supply-mutations.ts       StockListPage.tsx             native-select.tsx  (novo)
  SuppliesListPage.tsx          StockLedgerPage.tsx           dialog.tsx         (novo)
  SupplyFormPage.tsx            StockEntryDialog.tsx
```

Os dois componentes novos merecem nota. O `select` do shadcn nunca foi adicionado a este repositório: `UserFormPage`
usa um `<select>` nativo estilizado com Tailwind, escrito inline. Três selects nesta fatia justificam extrair o padrão
que já existe, não trocá-lo por uma primitiva de listbox — o nativo dispensa portal e funciona com
`userEvent.selectOptions` no jsdom. O arquivo se chama `native-select.tsx` para não colidir com o que
`npx shadcn add select` geraria depois. Já o `dialog` é primitiva de verdade, do `@base-ui/react`: o `alert-dialog` que
existe tem papel de interrupção, e um formulário dentro de um `alertdialog` mente para quem usa leitor de tela.

`features/stock` importa `useSupplies` de `features/supplies`. As duas telas leem `GET /supplies` — uma para o cadastro,
outra para o saldo — e são a mesma requisição. Uma query própria em `features/stock` daria duas caches do mesmo dado,
que dessincronizam assim que uma entrada mudar o saldo.

`SupplyFormPage` serve criar e editar, como `UserFormPage` faz na fatia 5. Não há campo exclusivo de um dos modos: o
`POST` e o `PATCH` aceitam os mesmos cinco campos, e a única diferença é o `PATCH` aceitá-los parciais.

Nenhuma `DataTable` genérica. Esta fatia acrescenta três listas às duas que já existem, e cinco `<table>` explícitas
continuam mais fáceis de ler que uma abstração que precisaria acomodar coluna de dinheiro, coluna de saldo, badge de
tipo e linha clicável condicional.

## A unidade

### O modelo

`src/lib/unit.ts` espelha o `UNIT_METADATA` do `wa-api`:

| Unidade | Dimensão | Fator para a base |
| ------- | -------- | ----------------- |
| `G`     | `WEIGHT` | 1                 |
| `KG`    | `WEIGHT` | 1000              |
| `ML`    | `VOLUME` | 1                 |
| `L`     | `VOLUME` | 1000              |
| `UN`    | `COUNT`  | 1                 |

É duplicação deliberada de uma tabela do back end. A alternativa seria não converter nada e mostrar a base crua, que a
seção seguinte descarta. Cinco linhas que só mudam se a API acrescentar unidade — e acrescentar unidade quebra tantas
outras coisas que ninguém faz em silêncio.

### A superfície

```ts
fromBase(base: number, unit: Unit) → number          // 12500, KG → 12.5
unitsOfDimension(unit: Unit) → Unit[]                // KG → [G, KG]
formatInUnit(base: number, unit: Unit) → string      // 12500, KG → "12,5 kg"
```

Não existe `toBase`. **A conversão é só de leitura**: `POST /supplies/:id/stock-entries` recebe `quantity` e `unit`
crus, e o back end converte com `Prisma.Decimal`. Multiplicar por 1000 no cliente antes de enviar reintroduziria ruído
de ponto flutuante num caminho onde a API já faz a conta com precisão exata. O front converte para mostrar, nunca para
gravar.

`formatInUnit` se apoia no `formatQuantity` que já existe em `src/lib/format.ts` e hoje não tem nenhum uso — foi escrito
na fatia 1 justamente para esta. Máximo de três casas decimais, separador brasileiro.

### O seletor

O select de unidade da entrada oferece só `unitsOfDimension(supply.purchaseUnit)`. Insumo em KG oferece grama e
quilograma; insumo em UN oferece só unidade. Isso torna o `DIMENSION_MISMATCH` da API inalcançável pela tela.

Continua tratado mesmo assim. A garantia é do back end — `assertItemDimension` —, não do select, e o dia em que o select
tiver um bug o erro tem que aparecer em vez de sumir.

O select da unidade de compra, no formulário de insumo, oferece as cinco. Ali não há dimensão prévia a respeitar: a
escolha **é** a declaração da dimensão do insumo.

## As telas

### `/supplies` — o cadastro

Nome, tipo, e o que se compra: `purchaseQty` na `purchaseUnit`, por `purchasePrice`. Tipo aparece como badge —
`Ingrediente` ou `Embalagem`. Preço formatado com `formatCurrency`, o outro par de funções que a fatia 1 deixou pronto
e sem uso.

Sem `SUPPLIES_WRITE`, some o botão de criar e a linha deixa de ser clicável, como nas listas da fatia 5.

### `/supplies/new` e `/supplies/:id` — o formulário

Cinco campos. A validação espelha o Zod do servidor para o erro aparecer antes da ida: nome não vazio, `purchaseQty`
positiva, `purchasePrice` não negativa — zero é válido, para o insumo que se recebe de graça —, tipo e unidade de
compra dos enums.

Editar a unidade de compra de um insumo que já tem saldo **não converte saldo nenhum**: `currentStock` está na base, e a
base de KG e de G é a mesma grama. Trocar KG por G muda só como o número aparece. Trocar KG por L, ao contrário, muda a
dimensão de um insumo cujas movimentações foram gravadas na outra — a API aceita o `PATCH` sem reclamar, e as entradas
futuras passam a ser validadas contra a dimensão nova. É um buraco do back end, não da tela; vira issue no `wa-api` e
não ganha trava aqui, pela mesma razão de sempre.

### `/stock` — os saldos

Uma linha por insumo: nome, saldo em `formatInUnit(currentStock, purchaseUnit)`, e o botão de entrada. Clicar na linha
abre o razão.

Saldo negativo é possível — produção pode consumir mais do que existe, e o back end registra e avisa em vez de recusar.
A tela mostra o número negativo em cor de alerta. Não é caso excepcional, é o estado que a fatia 4 vai produzir de
propósito.

### `StockEntryDialog` — a entrada

Quantidade, unidade e observação opcional, sobre o nome do insumo. A resposta traz `{ movement, currentStock }`, e o
`currentStock` de volta é o que confirma: o toast de sucesso cita o saldo novo, já convertido. Fechar e reabrir para
outro insumo é a operação esperada.

### `/stock/:id` — o razão

Data, tipo, quantidade com sinal e observação. Tipo vira rótulo em português: `ENTRY` é Entrada, `PRODUCTION` é
Produção, `WASTE` é Perda. Movimento de produção e de perda são negativos no banco, então o sinal sai do próprio
`quantityBase` — a tela não decide sinal por tipo.

Paginação por cursor com `useInfiniteQuery`: `getNextPageParam` lê o `nextCursor`, e `null` desliga o botão de carregar
mais. Limite padrão da API é 50, teto 100; a tela usa o padrão. Não há rolagem infinita — botão explícito, porque o
razão é consulta, e carregar sem pedir atrapalha quem está conferindo.

O cabeçalho mostra o nome do insumo e o saldo atual, vindos de `useSupply(id)`. Insumo inexistente devolve `404` nas
duas queries e cai no `QueryErrorState` com "Insumo não encontrado" e link para `/stock`.

## Dados e invalidação

| Chave                              | Query                                              |
| ---------------------------------- | -------------------------------------------------- |
| `["supplies"]`                     | `GET /supplies` — serve `/supplies` e `/stock`     |
| `["supplies", id]`                 | `GET /supplies/:id`                                |
| `["supplies", id, "movements"]`    | `GET /supplies/:id/movements`, infinita            |

Toda mutação de insumo — criar, editar, excluir — invalida `["supplies"]`. A entrada de estoque invalida `["supplies"]`,
porque o saldo mudou e a lista de saldos precisa refletir, e `["supplies", id, "movements"]`, porque o razão daquele
insumo ganhou uma linha.

Nada aqui toca `["me"]`: ao contrário da fatia 5, nenhuma tela desta fatia muda a permissão de quem está logado.

A invalidação continua grossa por hierarquia de chave — invalidar `["supplies"]` alcança `["supplies", id]` e o razão
junto. É mais do que o mínimo e é a mesma escolha da fatia 5: errar barato é melhor que acertar frágil.

## Erros

A regra da fatia 5 vale sem mudança: **o que a pessoa pode consertar no formulário fica no formulário; o que ela não
pode consertar vira toast.** `form-errors.ts`, `QueryErrorState`, `RouteError` e `ConfirmDialog` são reaproveitados como
estão.

Um caso novo. `DELETE /supplies/:id` responde **409** quando o insumo está referenciado — e no schema do `wa-api` tanto
`RecipeItem.supplyId` quanto `StockMovement.supplyId` usam `onDelete: Restrict`. Na prática: **insumo que já recebeu uma
entrada nunca mais pode ser excluído.** Só some do sistema o insumo recém-cadastrado que nunca foi movimentado nem
entrou em receita.

A tela não tem como antecipar isso. `currentStock` igual a zero não prova ausência de movimento — uma entrada de 5 kg
seguida de produção que consumiu 5 kg deixa saldo zero e duas linhas no razão. Esconder ou desabilitar o botão exigiria
um dado que `GET /supplies` não devolve. Então o botão fica, o `409` é tratado, e a mensagem é da tela, não da API: o
handler do `wa-api` responde a qualquer `P2003` com _"Operação viola uma referência existente"_, que não diz à pessoa o
que fazer. A tela diz: **"Não é possível excluir um insumo que já tem movimentação de estoque ou que faz parte de uma
receita."** Aqui, diferente do `409` ambíguo de usuário na fatia 5, a precisão é legítima — são as duas únicas
referências que o schema permite.

## Testes

TDD. Todos nascem vermelhos, e o MSW serve a API — nada disso precisa do back end de pé.

Lógica pura primeiro, que é onde mora o risco de mostrar um saldo errado:

1. `fromBase` converte nas cinco unidades, incluindo as de fator 1
2. `fromBase` preserva o sinal: saldo negativo continua negativo
3. `unitsOfDimension` devolve só as unidades da mesma dimensão, e inclui a própria
4. `formatInUnit` formata em português com no máximo três casas e o rótulo da unidade
5. As dimensões de `unit.ts` batem com as do `wa-api` — tabela exaustiva, para unidade nova não entrar em silêncio

Portão e navegação:

6. `/supplies/new` sem `SUPPLIES_WRITE` mostra o 403
7. Lista de insumos sem `SUPPLIES_WRITE` não mostra o botão de criar
8. `/stock` sem `STOCK_WRITE` não mostra o botão de entrada
9. Toda rota de `NAV_ITEMS` resolve no router, agora com `/supplies` e `/stock` reais

Insumos:

10. Lista mostra nome, tipo, o que se compra e o preço formatado
11. Criação envia os cinco campos e, no sucesso, volta para a lista
12. `purchasePrice` zero é aceito; `purchaseQty` zero é recusado no cliente
13. Edição abre com os valores do insumo e envia `PATCH`
14. Exclusão pede confirmação antes de chamar a API
15. `409` na exclusão vira toast com a mensagem da tela, e a linha permanece

Estoque:

16. Saldo aparece na unidade de compra do insumo: 12500 com `purchaseUnit` KG lê "12,5 kg"
17. Saldo negativo aparece marcado
18. O select da entrada oferece só as unidades da dimensão do insumo
19. A entrada envia `quantity` e `unit` crus, sem conversão
20. Sucesso da entrada invalida a lista e cita o saldo novo no toast
21. O razão mostra tipo em português e quantidade com sinal, na unidade de compra
22. O razão carrega a segunda página com o `nextCursor`, e esconde o botão quando ele vem `null`
23. `404` no razão mostra "Insumo não encontrado" com link para `/stock`

## Achados no `wa-api`

Fora do escopo desta fatia. Viram issue no outro repositório:

- `PATCH /supplies/:id` aceita trocar `purchaseUnit` para outra dimensão num insumo que já tem movimentações gravadas na
  dimensão antiga, sem migrar nem recusar
- O `409` de `P2003` responde _"Operação viola uma referência existente"_ sem `code` e sem dizer qual referência, o que
  obriga cada cliente a inferir a causa pelo endereço que chamou
- **`STOCK_READ` não consegue ler estoque.** As duas telas de `/stock` tiram os dados de `GET /supplies`, que exige
  `SUPPLIES_READ` (`supplies.routes.ts:21`). São permissões independentes do mesmo enum, e o menu mostra Estoque só com
  `STOCK_READ`. Um papel de estoquista — que a tela de papéis deixa qualquer um montar — vê o item no menu, passa pelo
  portão de rota e cai num erro de permissão com um botão de tentar de novo que nunca vai funcionar. Não aparece com o
  papel do seed, que tem tudo. O conserto é do back end: ou `STOCK_READ` passa a ler `/supplies`, ou existe uma rota de
  saldos própria. Travar a rota nas duas permissões no front end só trocaria um erro confuso por um 403 — não faria o
  papel funcionar.

## Achado fora desta fatia, na fundação

Não é desta fatia nem do módulo de insumos, mas foi esta fatia que o tornou visível, e ele é mais grave que os de cima:

**A sessão do wa-web quebra contra a wa-api atual.** `POST /sessions` só devolve `refreshToken` no corpo quando a
requisição manda o cabeçalho `x-refresh-delivery: body` (`auth.routes.ts:58`); sem ele, o refresh vai num cookie
`HttpOnly` e o corpo traz só o `accessToken`. O wa-web não manda esse cabeçalho, e `auth.api.ts` lê `pair.refreshToken`
sem verificar, gravando a string `"undefined"` no `localStorage`. O login funciona e todas as telas funcionam — até o
access token expirar, por volta de 15 minutos, quando a pessoa é jogada de volta para o login. O logout também erra.

Os tipos regenerados na Task 1 já descrevem `refreshToken` como opcional; o `tsc` não acusou porque `auth.api.ts`
escreve o contrato à mão em vez de derivar de `@/lib/api.types` — que era o minor diferido da Task 1, e deixou de ser
questão de estilo. Conserto numa fatia própria: mandar o cabeçalho no login, ou adotar o fluxo de cookie.
