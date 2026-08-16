# Usuários e Papéis do wa-web — Design

Data: 2026-08-16
Fatia: 5 do fatiamento em [Fundação e Autenticação](2026-08-15-fundacao-autenticacao-design.md), trazida para frente
API consumida: `wa-api`, rotas `/users`, `/users/:id`, `/users/:id/permissions`, `/roles`, `/roles/:id`

## Problema

A fundação está de pé e não administra nada. Hoje só existe usuário porque o seed criou um: para dar acesso a uma
segunda pessoa é preciso `POST /users` na mão, pelo Swagger, com o corpo montado por quem conhece o enum de permissão.
Enquanto isso durar, o sistema tem exatamente um operador.

O que torna esta fatia mais que um CRUD é o modelo de autorização do back end. Permissão efetiva não é um campo: é o
resultado de `(papel ∪ concedidas) − negadas`, com a negação sempre ganhando. São 13 permissões, um papel opcional e
duas listas de exceção. Uma tela que exponha esses três campos crus transfere a conta para a cabeça de quem opera, e
errar a conta significa dar ou tirar acesso sem perceber.

## Decisões de desenho

| Decisão              | Escolha                                     | Por quê                                                                                    |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Edição de permissão  | Marca-se o resultado; o app deriva a exceção | Ninguém opera "conceder além do papel"; opera "essa pessoa pode isso"                       |
| Troca de papel       | Substitui as marcas pelas do papel novo     | Escolher papel é aplicar o papel; preservar faria o seletor parecer quebrado                |
| Formulário           | Rota própria, não modal                     | Papel mais 13 permissões não cabem confortáveis em modal, e a rota dá link direto           |
| Menu                 | Dois itens irmãos, `Usuários` e `Papéis`    | Hierarquia para dois itens é estrutura antes da necessidade                                 |
| Travas de segurança  | Nenhuma no front end                        | Trava de tela não protege quem chama a API direto; o buraco é do back end e vira issue      |
| Infraestrutura nova  | Só o que se repete dentro desta fatia       | Duas listas parecidas são pouca evidência para desenhar uma tabela genérica                 |
| Invalidação de cache | Grossa: `users`, `roles` e `me` sempre      | O caso de editar a si mesmo obriga; o custo evitado seria três `GET` de lista curta         |

## Escopo

Entra: CRUD de usuários (sem exclusão, que a API não oferece), CRUD de papéis, edição de permissão efetiva por usuário,
ativação e desativação.

Fora: troca de senha — não há endpoint ([#19](https://github.com/wladimiroliveira/wa-api/issues/19)); exclusão de
usuário — não há `DELETE /users/:id`; edição de e-mail — `PATCH /users/:id` não aceita o campo; paginação, busca e
ordenação — a API não oferece; auditoria de quem mudou o quê; tema escuro; `DataTable` genérica.

## Rotas

| Rota         | Permissão     | Tela   |
| ------------ | ------------- | ------ |
| `/users`     | `USERS_READ`  | lista  |
| `/users/new` | `USERS_WRITE` | criar  |
| `/users/:id` | `USERS_WRITE` | editar |
| `/roles`     | `USERS_READ`  | lista  |
| `/roles/new` | `USERS_WRITE` | criar  |
| `/roles/:id` | `USERS_WRITE` | editar |

Segmento de URL é identificador: fica em inglês, como o resto do código. Português só no texto que a pessoa lê.

Quem tem apenas `USERS_READ` vê as listas sem o botão de criar e sem linha clicável. Digitando `/users/new` na barra de
endereço, cai na tela de 403 que a fatia 1 construiu. O portão é a rota, não o botão — botão escondido não é segurança.

`router.tsx` muda. Hoje ele gera as seis rotas de módulo com `NAV_ITEMS.map()`, todas apontando para
`UnderConstructionPage`. Com `/users` e `/roles` reais, a geração deixa de servir: as rotas passam a ser declaradas
explicitamente, e o placeholder fica só nas quatro que ainda não existem. A garantia automática de que todo item do menu
tem rota se perde nessa troca, então ela vira teste.

## Estrutura

```
src/features/users/          src/features/roles/         src/features/auth/
  users.api.ts                 roles.api.ts                permission-labels.ts   (novo)
  use-users.ts                 use-roles.ts                permission-diff.ts     (novo)
  use-user.ts                  use-role-mutations.ts       PermissionPicker.tsx   (novo)
  use-user-mutations.ts        RolesListPage.tsx
  UsersListPage.tsx            RoleFormPage.tsx          src/components/common/   (novo)
  UserFormPage.tsx                                         PageHeader.tsx
                                                           ConfirmDialog.tsx
                                                           QueryErrorState.tsx
                                                           RouteError.tsx
```

Tudo que é permissão mora em `features/auth/`, que já é dono de `Permission` e `hasPermission`. Usuários e papéis
importam de lá. Um módulo `permissions/` separado daria duas casas ao mesmo conceito.

`UserFormPage` serve criar e editar. A diferença é o campo de senha, que só existe na criação porque a API só aceita
senha lá, e o `isActive`, que só existe na edição. `RoleFormPage` segue a mesma forma.

De `shadcn/ui` entram `table`, `checkbox`, `select`, `alert-dialog` e `badge`. Nenhuma `DataTable` genérica: duas
`<table>` explícitas até uma terceira lista pedir outra coisa.

## O editor de permissões

### A derivação

Com `D` o conjunto marcado na tela e `R` o conjunto do papel escolhido:

```
granted = D − R        denied = R − D
```

O ida e volta é exato — `(R ∪ (D − R)) − (R − D) = D` — e tem um efeito colateral desejável: salvar normaliza exceção
redundante. Quem tinha `SUPPLIES_READ` concedida na mão _e_ herdada do papel sai com `granted` limpo, sem mudar um bit
do acesso efetivo.

`permission-diff.ts` é função pura, sem import de React:

```ts
toExceptions(desired, rolePermissions) → { grantedPermissions, deniedPermissions }
originOf(permission, desired, rolePermissions) → "role" | "granted" | "denied" | "none"
```

A segunda alimenta a anotação ao lado de cada linha — "do papel", "+", "−" — para a origem de cada marca ficar visível
sem que a pessoa precise conhecer o modelo.

### O estado inicial

O conjunto marcado da tela de edição vem de `GET /users/:id/permissions`, não de uma conta feita no cliente. Custa uma
requisição a mais numa página que já faz duas, e em troca o formulário abre a partir da resposta do servidor: o front
end nunca reimplanta a regra de precedência. É também o único cliente que esse endpoint tem.

### A troca de papel

Trocar o papel substitui as marcas pelas do papel novo, e as exceções zeram. Escolher um papel é um ato deliberado —
"essa pessoa é estoquista" — e o resultado esperado é ficar com o que estoquista tem. Preservar as marcas manteria o
acesso efetivo idêntico depois da troca, o que na tela parece que o seletor não fez nada.

Nada é escondido: as caixas mudam à vista, dá para remarcar antes de salvar, e nada vai para a API até o Salvar.

Sem papel — `roleId: null` — o conjunto do papel é vazio e tudo que for marcado vira `granted`. É o estado de quem ficou
órfão depois de um papel excluído.

### Os rótulos

`permission-labels.ts` é um `Record<Permission, { group, action }>` com os rótulos em português, agrupados por módulo.
Ser um `Record` completo é a decisão: quando o `wa-api` acrescentar `ROLES_READ` e `ROLES_WRITE`, o `tsc` quebra ali até
alguém escrever os rótulos novos. Contrato novo não entra em silêncio.

O `PermissionPicker` recebe `rolePermissions` opcional. Com ele, anota a origem de cada marca; sem ele, é uma lista
chapada de caixas — que é a forma usada pelo formulário de papel, onde não existe exceção e as marcas viram
`permissions` direto.

## Validação e conflito

A validação de formulário espelha o Zod do servidor, para o erro aparecer antes da ida: nome não vazio, `username` de 3
a 30 caracteres em `[a-z0-9._-]`, e-mail válido, senha de 8 no mínimo. O `username` é minusculado no cliente, porque o
servidor minuscula de qualquer jeito — sem isso a pessoa digita `Maria`, salva, e a lista volta com `maria`.

O `409` merece cuidado. O handler do `wa-api` responde a qualquer violação de unicidade com a mesma frase, _"Já existe
um registro com esse valor único"_, sem dizer o campo. Em `POST /users` o conflito pode ser `username` ou `email`, e o
front end não tem como saber qual: o erro aparece **acima do formulário**, citando as duas possibilidades. Em papel,
`name` é o único campo único, então lá o `409` vira erro inline no campo. Fingir precisão que a API não deu seria pior
que a frase mais larga.

Daí sai a regra de erro de mutação da fatia: **o que a pessoa pode consertar no formulário fica no formulário; o que ela
não pode consertar — `500`, rede fora — vira toast.**

## Dados e invalidação

Chaves: `["users"]`, `["users", id]`, `["users", id, "permissions"]`, `["roles"]`.

Toda mutação de usuário ou papel invalida `["users"]`, `["roles"]` e `["me"]`. É grosso de propósito. O caso que obriga é
editar a si mesmo: trocando o próprio papel sem recarregar `["me"]`, o menu lateral e os portões de rota continuam
decidindo pela permissão velha, e a interface passa a mentir sobre o que a pessoa pode fazer. Invalidar cirurgicamente
exigiria comparar o `id` editado com o da sessão em cada mutação, e o custo evitado seriam três `GET` de lista curta e
sem paginação. Errar barato é melhor que acertar frágil.

`["me"]` tem `staleTime: Infinity`, o que não atrapalha: `invalidateQueries` refaz a busca dos observadores montados de
qualquer jeito.

Excluir um papel devolve `204` e zera o `roleId` de quem o usava, em silêncio — é o `onDelete: SetNull` do schema. A
lista de usuários recarrega e aquelas pessoas aparecem com papel `—`. A tela não avisa antes, por decisão registrada
abaixo; ela ao menos não mente depois.

## Tratamento de erro

A fatia 1 prometeu um `errorElement` de rota com botão de tentar de novo. Cumprir ao pé da letra entregaria um botão que
não funciona, e o motivo é mecânico: o `errorElement` do React Router captura o que é **lançado** no render ou num
loader, e erro de query do TanStack Query não é lançado — vira estado `error` dentro do componente. Levá-lo até lá
exigiria `throwOnError`, e aí o botão ficaria sem como se recuperar, porque o React Router não oferece API para resetar
a fronteira de erro sem navegar.

A promessa é dividida em duas peças, cada uma onde funciona:

| Peça                    | Onde                    | O que faz                                                                                 |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `QueryErrorState`       | dentro das páginas      | Mostra a `message` da API e um "Tentar de novo" ligado ao `refetch()` da própria query      |
| `RouteError`            | `errorElement` do módulo | Rede de segurança para o que for lançado no render: mensagem e link de volta para a lista   |

O caminho que a pessoa vai encontrar de verdade — API fora do ar, rede caída, `500` — é o primeiro. Um `GET /users/:id`
com id inexistente devolve `404` e cai no mesmo estado inline, com "Usuário não encontrado" e link para a lista: não é
caso excepcional, é URL velha.

Sessão expirada não muda nada: `queryCache.onError` limpa e reseta `["me"]`, e o guarda redireciona. Como as queries
desta fatia não lançam, nada aqui interfere nesse caminho.

## Testes

TDD. Todos nascem vermelhos, e MSW serve a API — nada disso precisa do back end de pé.

Lógica pura primeiro, que é onde mora o risco de dar acesso errado a alguém:

1. `permission-diff` — ida e volta: aplicar `(papel ∪ concedidas) − negadas` ao resultado devolve o conjunto marcado,
   com papel, sem papel e com papel vazio
2. `permission-diff` — exceção redundante some: permissão que o papel já dá não sai em `granted`
3. `permission-diff` — `originOf` classifica papel, concedida, negada e nenhuma
4. `permission-labels` — toda chave do `Record` aparece exatamente uma vez no agrupamento por módulo

Portão e navegação:

5. `/users/new` sem `USERS_WRITE` mostra o 403, não o login
6. Lista sem `USERS_WRITE` não mostra o botão de criar
7. Toda rota de `NAV_ITEMS` resolve no router

Usuários:

8. Lista mostra nome, usuário, papel e situação; papel nulo aparece como `—`
9. Criação envia a senha e, no sucesso, volta para a lista
10. `409` na criação mostra erro acima do formulário, citando nome de usuário ou e-mail
11. `username` vai minusculado para a API
12. Edição abre com as caixas vindas de `GET /users/:id/permissions`
13. Trocar o papel substitui as marcas pelas do papel novo
14. Salvar envia `granted` e `denied` derivados, nunca o conjunto marcado
15. Edição não envia `password` nem `email`
16. Editar a si mesmo recarrega `["me"]`: o menu passa a refletir a permissão nova

Papéis:

17. Excluir pede confirmação; confirmar chama `DELETE` e a lista recarrega
18. `409` na criação vira erro inline no campo nome

Erro:

19. Falha de rede na lista mostra o estado de erro, e "Tentar de novo" refaz a busca

Os testes 1, 13 e 14 são os que justificam esta fatia ser desenhada em vez de escrita direto.

## Riscos assumidos

- **Nenhuma trava de segurança no front end.** A tela permite tudo que a API permite, incluindo se desativar, se
  rebaixar e esvaziar o papel Owner. É decisão consciente: trava de interface não protege quem chama a API direto, e
  fingir proteção seria pior que não ter. A correção pertence ao back end, e está registrada abaixo.
- **Excluir papel tira acesso em silêncio.** O diálogo de confirmação não diz quantos usuários perdem o papel. Contar
  seria possível — a lista de usuários já está em cache —, e ficou de fora por decisão de escopo.
- **A grade de 13 permissões cresce com o contrato.** Em 15 ou 20 ainda cabe na tela; muito além disso, a forma precisa
  ser repensada. O `Record<Permission, …>` garante que ninguém descubra tarde demais.

## Achados no `wa-api`

Nenhum bloqueia esta fatia. Todos viram issue no outro repositório.

| #   | Achado                                                                                                                                                                                              | Gravidade |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `grantedPermissions` é campo livre no `updateUserSchema`: quem tem `USERS_WRITE` concede as 13 a si mesmo e vira root. Sem trava de autoedição, também dá para se desativar e revogar a própria entrada | Alta      |
| 2   | `USERS_*` cobre usuários e papéis ao mesmo tempo. Falta `ROLES_READ`/`ROLES_WRITE` para separar quem cadastra gente de quem redefine o que um papel significa                                          | Média     |
| 3   | `DELETE /roles/:id` com `onDelete: SetNull` remove acesso de todos os usuários do papel em silêncio. Devia recusar com `409` quando o papel está em uso, ou exigir papel substituto                    | Média     |
| 4   | O papel `Owner` é papel comum, criado pelo seed. Nada impede esvaziá-lo, renomeá-lo ou excluí-lo                                                                                                      | Média     |
| 5   | O `409` não diz o campo em conflito. O `P2002` do Prisma traz `meta.target` e o handler descarta                                                                                                      | Baixa     |
| 6   | `PATCH /users/:id` não aceita `email`: e-mail errado no cadastro é permanente. Parente do [#19](https://github.com/wladimiroliveira/wa-api/issues/19)                                                 | Baixa     |

O achado 2 foi levantado como possível solução para o achado 1 e não resolve: a escalada de `grantedPermissions` não
passa por papel nenhum. Separar as permissões é ganho real de segregação de funções, e é ortogonal.
