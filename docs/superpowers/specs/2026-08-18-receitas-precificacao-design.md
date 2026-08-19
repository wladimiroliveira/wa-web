# Receitas e Precificação do wa-web — Design

Data: 2026-08-18
Fatia: 3 do fatiamento em [Fundação e Autenticação](2026-08-15-fundacao-autenticacao-design.md)
API consumida: `wa-api` no commit `3d33e79`, rotas `/recipes`, `/recipes/:id`, `/recipes/:id/margin`,
`/recipes/:id/pricing`

## Problema

A fatia 2 deixou a padaria capaz de cadastrar farinha e saber quanto tem dela. Não a deixou capaz de responder a única
pergunta que paga a conta: **por quanto vender o cento**.

Essa resposta existe inteira no back end desde o começo — `calculatePricing` soma o custo dos insumos do lote, divide
pelo rendimento em centos, acrescenta a mão de obra, aplica a margem e arredonda para cima ao real. O que não existe é
tela. Hoje `/recipes` é um placeholder de "em construção", e uma receita só pode ser criada por `curl`.

Duas coisas tornam esta fatia mais que um CRUD com uma tabela de números no fim.

A primeira é que **receita é um formulário composto**: cabeçalho e itens são uma submissão só. `POST /recipes` exige ao
menos um item no mesmo corpo, e `PATCH /recipes/:id` interpreta `items` como **substituição do conjunto inteiro**. Não
há endpoint de item. A tela que adicionasse insumos depois de salvar não tem contrato para existir.

A segunda é que **precificação tem permissão própria**. `GET /recipes/:id/pricing` exige `PRICING_READ`, que é
independente de `RECIPES_READ` e de `RECIPES_WRITE`. O enum de permissões prevê alguém que monta receita e não vê
preço, e alguém que vê preço e não monta receita. O desenho das rotas tem que preservar essa separação em vez de
achatá-la.

## Decisões de desenho

| Decisão                     | Escolha                                     | Por quê                                                                             |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Onde o preço aparece        | Rota própria, `/recipes/:id/pricing`        | Permissão é outra, e a API só calcula uma receita por vez — não há preço em lote     |
| Guard da tela de preço      | `RECIPES_READ` **e** `PRICING_READ`         | Ela lê as duas rotas: o nome e a margem vêm da receita, não da resposta de pricing   |
| Cabeçalho e itens           | Um formulário só, `useFieldArray`           | O `POST` exige ≥1 item no mesmo corpo; itens não têm contrato para viver noutra tela |
| Margem na tela              | Campo em `%`, convertido nas bordas         | A API guarda fração; digitar 35 e gravar 3500 % é o erro que o campo cru convida     |
| Conversão de margem         | Módulo próprio, `recipes/margin.ts`         | `0.35 * 100` dá `35.000000000000004`, e a conversão aparece em duas telas            |
| Unidade do item             | Restrita à dimensão do insumo escolhido     | Torna o `400` de dimensão inalcançável pela tela, com `unitsOfDimension` que já existe |
| Insumo repetido na receita  | Recusado no cliente                         | A API aceita; somar farinha duas vezes no mesmo lote é engano, não intenção          |
| Colunas da lista            | Só o que `GET /recipes` devolve             | A lista é rasa — sem itens e sem custo; preço por linha custaria uma requisição cada |
| Infraestrutura nova         | Nenhuma                                     | `native-select`, `dialog`, `ConfirmDialog` e `QueryErrorState` cobrem esta fatia     |

## Escopo

Entra: CRUD de receitas com itens, e a tela de precificação.

Fora: **ajuste rápido de margem** — `PATCH /recipes/:id/margin` fica sem cliente nesta fatia; a margem se edita pelo
formulário, junto do resto. Fora também: produção e perdas — fatia 4; simulação de preço, isto é, mexer na margem e ver
o preço mudar sem salvar — a API não expõe cálculo sobre valores hipotéticos, só sobre o que está gravado; busca e
ordenação de receitas — `GET /recipes` não aceita parâmetro; duplicar receita — não há endpoint; histórico de preço — não
há modelo; tema escuro; `DataTable` genérica.

Fora e registrado para não se perder: a **troca de senha** continua pendente desde a fatia 2, e `PATCH /me/password` e
`PATCH /users/:id/password` seguem sem cliente. É dívida do módulo de usuários.

Não há regeneração de tipos nesta fatia. O `src/lib/api.types.ts` foi gerado na fatia 2 a partir do `openapi.json` do
`wa-api` e já descreve as quatro rotas de receita, incluindo `/recipes/:id/pricing`. Se o `tsc` discordar disso no
primeiro passo, regenerar entra como primeiro passo da implementação.

## Rotas

| Rota                    | Guard                             | Tela          |
| ----------------------- | --------------------------------- | ------------- |
| `/recipes`              | `RECIPES_READ`                    | lista         |
| `/recipes/new`          | `RECIPES_WRITE`                   | cadastrar     |
| `/recipes/:id`          | `RECIPES_WRITE`                   | editar        |
| `/recipes/:id/pricing`  | `RECIPES_READ` + `PRICING_READ`   | precificação  |

Três costuras no `router.tsx`.

`/recipes` sai de `BUILT_ROUTES` — hoje ele cai no `UnderConstructionPage`. Sobram `/productions` e `/wastes` como
placeholder. O `NAV_ITEMS` não muda: a entrada "Receitas" já existe desde a fatia 1, com `RECIPES_READ`.

`/recipes/new` é declarada antes de `/recipes/:id`, pela mesma regra que já vale em `/supplies` e `/users`: estática
antes de dinâmica, senão `new` é lido como id.

A tela de preço aninha dois `RequirePermission`. `RequirePermission` renderiza `<Outlet/>`, então aninhar é a forma que
o componente já suporta, sem variante nova que aceite lista de permissões. A ordem importa para o que a pessoa lê: o
externo é `RECIPES_READ` — quem não pode ver receita nenhuma não deve descobrir que esta existe — e o interno é
`PRICING_READ`.

## Estrutura

```
src/features/recipes/
  recipes.api.ts             tipos derivados de paths[...] e as seis chamadas
  use-recipes.ts             lista                    ["recipes"]
  use-recipe.ts              detalhe com itens        ["recipes", id]
  use-recipe-pricing.ts      preço                    ["recipes", id, "pricing"]
  use-recipe-mutations.ts    create / update / delete, com invalidação
  margin.ts                  fração ⇄ percentual
  RecipesListPage.tsx
  RecipeFormPage.tsx
  RecipePricingPage.tsx
```

Nada de componente novo em `components/ui`. `native-select` cobre o seletor de insumo e o de unidade, `Input` e `Label`
cobrem o resto, `ConfirmDialog` cobre a exclusão, `QueryErrorState` cobre a falha de leitura. A fatia 2 pagou essa
infraestrutura; esta a usa.

`features/recipes` importa `useSupplies` de `features/supplies` e `unitsOfDimension` de `lib/unit`. É a mesma decisão da
fatia 2 quando `features/stock` passou a ler a query de insumos: uma requisição, uma cache. O formulário de receita
precisa da lista de insumos para o `<select>`, e é a mesma lista que `/supplies` e `/stock` já leem.

`RecipeFormPage` serve criar e editar, como `SupplyFormPage` e `UserFormPage`. Não há campo exclusivo de um dos modos —
o `PATCH` aceita os mesmos campos do `POST`, só que parciais, e esta tela manda todos de qualquer forma.

## A margem

A API guarda `margin` como fração não negativa, e `calculatePricing` faz `exactPrice = totalCostPerHundred × (1 + margin)`.
Uma margem de 35 % é `0.35` no banco.

A tela fala em percentual. A pessoa digita `35`, lê `35 %`, e nunca vê `0.35`. Não é enfeite: o campo cru aceita `35`
sem reclamar — `nonnegative` não tem teto — e grava uma margem de 3500 %, que sai do outro lado como um preço quarenta
vezes maior sem nenhum erro em lugar nenhum.

A conversão mora em `recipes/margin.ts`, com teste, por dois motivos. Primeiro, ela aparece em dois lugares: o
formulário, que converte nos dois sentidos, e a tela de preço, que converte para exibir. Regra em dois lugares é regra
para extrair. Segundo, ponto flutuante: `0.35 * 100` é `35.000000000000004` em JavaScript, e um campo que abre com esse
valor está errado na cara de quem lê.

```ts
toPercent(fraction: number) → number    // 0.35 → 35     (arredondado a uma casa)
fromPercent(percent: number) → number   // 35   → 0.35
```

`fromPercent` divide, e dividir não precisa de arredondamento: `35 / 100` produz o double mais próximo de `0.35`, que é
exatamente o que `JSON.stringify` escreve como `0.35`. `toPercent` multiplica, e por isso arredonda.

## As telas

### `/recipes` — a lista

`GET /recipes` é rasa: id, nome, `batchYield`, `laborCostPerHundred`, `margin` e timestamps. Sem itens e sem custo. A
tabela mostra o que existe — **Nome · Rendimento · Mão de obra / cento · Margem** — e as ações.

Não há coluna de preço, e isso é imposição do contrato, não escolha de tela: preço sai de `GET /recipes/:id/pricing`,
uma receita por vez. Vinte receitas na lista seriam vinte requisições para preencher uma coluna. Quem quer o preço abre
a receita.

`batchYield` é contagem de peças por lote — o cálculo divide por 100 para chegar ao cento —, então aparece com
`formatQuantity` e o rótulo de unidade: `100 un`.

Sem `RECIPES_WRITE`, some o botão de criar, o nome deixa de ser link e some o botão de excluir, como nas listas das
fatias anteriores. Sem `PRICING_READ`, some o link de preço. Lista vazia diz "Nenhuma receita cadastrada".

### `/recipes/new` e `/recipes/:id` — o formulário

Quatro campos de cabeçalho — nome, rendimento do lote, mão de obra por cento, margem em `%` — e a lista de itens.

A validação espelha o Zod do servidor, para o erro aparecer antes da ida e volta:

```ts
const recipeSchema = z.object({
  name:                z.string().trim().min(1, "Informe o nome"),
  batchYield:          z.coerce.number().positive("Informe um rendimento maior que zero"),
  laborCostPerHundred: /* vazio → NaN */ z.coerce.number().nonnegative("Não pode ser negativo"),
  marginPercent:       /* vazio → NaN */ z.coerce.number().nonnegative("A margem não pode ser negativa"),
  items: z.array(z.object({
    supplyId:  z.string().uuid("Escolha o insumo"),
    usageQty:  z.coerce.number().positive("Informe a quantidade"),
    usageUnit: z.enum(["G", "KG", "ML", "L", "UN"]),
  })).min(1, "Adicione ao menos um insumo"),
}).refine(/* supplyId não repetido */);
```

O `preprocess` de vazio → `NaN` em `laborCostPerHundred` e `marginPercent` é o mesmo cuidado que `SupplyFormPage` já
documenta: `Number("")` é `0`, então sem ele um campo em branco viraria "mão de obra grátis" e "margem zero" em
silêncio, em vez de falhar como não respondido. Zero digitado continua válido nos dois — receita sem mão de obra
alocada existe, e margem zero é venda a preço de custo.

**Os itens.** `useFieldArray` do react-hook-form, uma linha por item: `<select>` de insumo, quantidade, `<select>` de
unidade e o botão de remover. O botão de remover fica sempre habilitado; remover o último não é bloqueado pelo botão,
é recusado pelo `min(1)` na submissão, com a mensagem "Adicione ao menos um insumo". Bloquear o botão exigiria explicar
por que ele está apagado; a mensagem explica sozinha.

**A unidade da linha é restrita à dimensão do insumo.** `unitsOfDimension(supply.purchaseUnit)`: insumo em KG oferece
grama e quilograma, insumo em UN oferece só unidade. Trocar o insumo de uma linha para outro de dimensão diferente
redefine a unidade da linha para a `purchaseUnit` do insumo novo — senão a linha ficaria com "kg" sob um insumo contado
em unidades, que é exatamente o `400` de `DIMENSION_MISMATCH` que a API devolveria. O erro deixa de ser alcançável pela
tela. Continua tratado mesmo assim, pela razão da fatia 2: a garantia é do back end, e o dia em que o select tiver um
bug o erro precisa aparecer em vez de sumir.

**Insumo repetido é recusado no cliente.** `RecipeItem` não tem `@@unique(recipeId, supplyId)` no schema do `wa-api`, e
a rota não checa: a mesma farinha entra duas vezes na mesma receita e o custo soma as duas linhas sem avisar. Duas
linhas do mesmo insumo num lote não têm leitura útil — se são 5 kg e 300 g, são 5,3 kg. O `refine` recusa com "Este
insumo já está na receita" na segunda linha.

**Sem insumo cadastrado, o formulário não finge.** Se `GET /supplies` vier vazio, no lugar dos campos aparece "Cadastre
um insumo antes de criar uma receita", com link para `/supplies/new`. A API exige ao menos um item e o `<select>`
estaria vazio; um formulário que só pode falhar não deve ser oferecido.

Na edição, `useRecipe(id)` traz a receita com os itens — cada um já com o insumo aninhado — e o `reset` semeia cabeçalho
e linhas de uma vez, `reset` e não `setValue`, para os campos não nascerem sujos. A submissão manda o payload inteiro,
itens inclusive, porque é assim que a API o interpreta. Um construtor de payload só serve `POST` e `PATCH`.

### `/recipes/:id/pricing` — o preço

Duas queries: `GET /recipes/:id` para o nome e a margem, `GET /recipes/:id/pricing` para os números. A resposta de
pricing não traz nem o nome nem a margem, e mostrar o preço sem dizer sobre qual margem ele foi calculado esconde
metade da informação.

Sete linhas, nesta ordem:

| Linha                | Origem                                          |
| -------------------- | ----------------------------------------------- |
| Insumos / cento      | pricing — `suppliesCostPerHundred`              |
| Mão de obra / cento  | receita — `laborCostPerHundred`                 |
| Custo total / cento  | pricing — `totalCostPerHundred`                 |
| Margem               | receita — `toPercent(margin)`                   |
| Preço exato          | pricing — `exactPrice`                          |
| **Cento**            | pricing — `pricePerHundred`                     |
| **Meio cento**       | pricing — `pricePerHalfHundred`                 |

A mão de obra é lida da receita e não subtraída dos dois custos: a subtração daria o mesmo número por outro caminho, e
o caminho da subtração inventa uma conta que a API já fez.

Preço exato aparece ao lado do cento de propósito. É onde o arredondamento fica visível — `R$ 68,04` vira `R$ 69,00`,
porque `roundUpToNearest` sobe ao real inteiro. Sem a linha do exato, o número do cento parece arbitrário.

Cento e meio cento ganham destaque tipográfico. São os dois números que a pessoa veio buscar; o resto é a memória de
cálculo que sustenta os dois.

## Dados e invalidação

| Chave                        | Query                          |
| ---------------------------- | ------------------------------ |
| `["recipes"]`                | `GET /recipes`                 |
| `["recipes", id]`            | `GET /recipes/:id`             |
| `["recipes", id, "pricing"]` | `GET /recipes/:id/pricing`     |

Criar, editar e excluir receita invalidam `["recipes"]`. A invalidação continua grossa por hierarquia de chave, como nas
fatias 2 e 5: `["recipes"]` é prefixo de `["recipes", id]` e de `["recipes", id, "pricing"]`, então uma chamada alcança
lista, detalhe e preço. Isso importa mais aqui que nas fatias anteriores — mudar um item da receita muda o preço dela, e
um preço em cache depois da edição é um número errado numa tela que existe para dar números certos.

Nada nesta fatia invalida `["supplies"]`: receita referencia insumo e não o altera. E nada toca `["me"]` — nenhuma tela
daqui muda a permissão de quem está logado.

Um vazamento que a hierarquia de chave não cobre: editar o **preço de compra de um insumo** muda o preço de toda receita
que o use, e a invalidação de `["supplies"]` não alcança `["recipes"]`. Não há como saber quais receitas usam o insumo
sem pedir o detalhe de todas. A escolha é invalidar `["recipes"]` junto com `["supplies"]` nas mutações de insumo —
grosso, barato, e do mesmo espírito de "errar barato é melhor que acertar frágil".

## Erros

A regra das fatias anteriores vale sem mudança: **o que a pessoa pode consertar no formulário fica no formulário; o que
ela não pode consertar vira toast.** `form-errors.ts`, `QueryErrorState`, `RouteError` e `ConfirmDialog` são
reaproveitados como estão.

Três casos merecem texto próprio.

**`409` na exclusão.** `Production.recipeId` é `onDelete: Restrict` e é a única referência a `Recipe` no schema, então a
causa é uma só e a mensagem pode ser precisa: **"Não é possível excluir uma receita que já tem produção registrada."** O
`wa-api` responde a qualquer `P2003` com _"Operação viola uma referência existente"_, que não diz a ninguém o que fazer.
A mensagem é da tela. É a mesma postura que a fatia 2 tomou com o `409` de insumo, e aqui é ainda mais defensável — lá
eram duas referências possíveis, aqui é uma.

**`409` no preço.** Este é o caso mais sutil da fatia. `GET /recipes/:id/pricing` devolve `409` com
`DIMENSION_MISMATCH` quando um item usa unidade de dimensão diferente da `purchaseUnit` do insumo. O formulário torna
isso impossível de criar — mas não impossível de acontecer: basta alguém editar o insumo depois e trocar a
`purchaseUnit` de KG para L. A receita foi salva válida e apodreceu de longe. A tela diz **"Um insumo desta receita
mudou para uma unidade de outra dimensão. Edite a receita para calcular o preço."**, com link para `/recipes/:id`. É o
único lugar onde a pessoa que vê o erro pode não ser a pessoa que pode consertá-lo — o link leva a uma rota
`RECIPES_WRITE`, e quem não a tem vai ler o 403. Sem `RECIPES_WRITE` não há conserto a oferecer.

**`404`.** `GET /recipes/:id` responde "Receita não encontrada"; `PATCH` e `DELETE` caem no `P2025` genérico do
`wa-api`, "Recurso não encontrado". Nas duas telas de detalhe o `404` vira `QueryErrorState` com "Receita não
encontrada" e link de volta para `/recipes`, sem repetir a frase da API.

## Testes

TDD. Todos nascem vermelhos, e o MSW serve a API — nada disso precisa do back end de pé.

Lógica pura primeiro, que é onde mora o risco de gravar uma margem quarenta vezes maior:

1. `toPercent` converte `0.35` em `35`, sem cauda de ponto flutuante
2. `toPercent` e `fromPercent` são inversas nos valores que a tela produz, incluindo zero
3. `fromPercent(35)` serializa como `0.35` em `JSON.stringify`

Portão e navegação:

4. `/recipes/new` sem `RECIPES_WRITE` mostra o 403
5. `/recipes/:id/pricing` com `PRICING_READ` e sem `RECIPES_READ` mostra o 403
6. `/recipes/:id/pricing` com `RECIPES_READ` e sem `PRICING_READ` mostra o 403
7. A lista sem `RECIPES_WRITE` não mostra o botão de criar nem o de excluir
8. A lista sem `PRICING_READ` não mostra o link de preço
9. Toda rota de `NAV_ITEMS` resolve no router, agora com `/recipes` real

Lista:

10. Mostra nome, rendimento com unidade, mão de obra formatada como moeda e margem em `%`
11. Lista vazia mostra a mensagem em vez da tabela
12. Exclusão pede confirmação antes de chamar a API
13. `409` na exclusão vira toast com a mensagem da tela, e a linha permanece

Formulário:

14. Criação envia cabeçalho e itens num corpo só, com `margin` em fração
15. Submeter sem nenhum item mostra "Adicione ao menos um insumo" e não chama a API
16. Remover linhas até esvaziar não quebra a tela
17. O select de unidade da linha oferece só as unidades da dimensão do insumo escolhido
18. Trocar o insumo da linha para outra dimensão redefine a unidade da linha
19. Repetir o mesmo insumo em duas linhas mostra o erro e não chama a API
20. Margem `0` e mão de obra `0` são aceitas; ambas em branco são recusadas
21. Edição abre com cabeçalho e itens da receita, com a margem já em `%`
22. Edição envia `PATCH` com o conjunto de itens inteiro, não só o que mudou
23. Sem insumo cadastrado, o formulário mostra o convite a cadastrar e nenhum campo

Preço:

24. Mostra as sete linhas, com cento e meio cento formatados como moeda
25. A margem exibida vem da receita, em `%`
26. `409` mostra a mensagem de dimensão com link para a edição
27. `404` mostra "Receita não encontrada" com link para `/recipes`

## Achados no `wa-api`

Fora do escopo desta fatia. Viram issue no outro repositório:

- **`RECIPES_WRITE` não consegue montar receita.** O formulário precisa da lista de insumos para o `<select>`, e
  `GET /supplies` exige `SUPPLIES_READ` (`supplies.routes.ts:21`). São permissões independentes do mesmo enum, e a
  rota de receita não pede `SUPPLIES_READ`. Um papel de confeiteiro — com `RECIPES_READ` e `RECIPES_WRITE`, sem
  `SUPPLIES_READ` — passa pelo portão de rota, abre o formulário e toma `403` na query dos insumos. É o mesmo defeito
  que a fatia 2 registrou para `STOCK_READ`, na terceira tela seguida em que ele aparece.
- **`RecipeItem` não tem `@@unique(recipeId, supplyId)`**, e nem a rota nem o repositório checam duplicata. A mesma
  farinha entra duas vezes na mesma receita, e `calculatePricing` soma as duas linhas sem avisar. Esta fatia recusa no
  cliente; a invariante é do banco.
- **`GET /recipes` não devolve custo nem preço**, nem em campo calculado nem por parâmetro opcional. Qualquer lista que
  queira mostrar preço por linha precisa de uma requisição por receita.
- **`PATCH /recipes/:id/margin` duplica um caminho que `PATCH /recipes/:id` já cobre.** Não é defeito, é observação: a
  rota existe sem cliente, e esta fatia não a usa. Se ninguém a reivindicar até a fatia 4, é superfície de API a menos.
