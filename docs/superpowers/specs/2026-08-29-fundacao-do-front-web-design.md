# Fundação do front web — Design

- **Data:** 2026-08-29
- **Repositório:** `wa-web`, árvore vazia desde o commit `6e26b60`
- **API consumida:** `wa-api` em `main` (`1f48dac`), prefixo `/v1`
- **Status:** aguardando revisão

## Problema

O `wa-api` está de pé com autenticação, autorização e a área de acesso
(`sessions`, `roles`, `users`), e nenhum cliente humano o consome — só o Swagger
UI. O `wa-web` foi zerado de propósito e precisa nascer de novo.

O software é operacional: registro de informação no dia a dia, por gente que não
escolheu usá-lo e não tem paciência para tela que trava ou sessão que cai. Os
requisitos que o dono do produto colocou são desempenho e estabilidade, e nessa
ordem de importância eles se traduzem em três exigências concretas para a
fundação: a sessão não pode cair sozinha, a tela nunca fica em branco sem
explicação, e o contrato com a API não pode quebrar em produção sem ter quebrado
antes no compilador.

Existe uma restrição do back end que, ignorada, quebra o produto de um jeito
difícil de diagnosticar e é o problema central desta fatia. Em
`auth.service.ts`, um refresh token já rotacionado que volta é lido como roubo, e
a reação é `revokeAllRefreshTokens(userId)`: **cai a sessão do usuário inteira,
em todos os dispositivos**. Duas requisições paralelas tomando `401`, ou duas
abas abertas na mesma conta, não derrubam uma aba — derrubam o operador que está
no tablet do chão de fábrica ao mesmo tempo. Serializar a rotação, inclusive
entre abas, é o requisito que organiza esta fatia; o resto é consequência.

## Restrições

- O `wa-api` é a **única** API. O front não tem servidor próprio, não guarda
  regra de negócio e nunca é a autoridade sobre permissão.
- Uso em desktop na rede local e em tablet/celular no chão de fábrica. Hardware
  modesto e tela pequena são caso previsto, não exceção.
- **Sem offline.** Decisão explícita do dono do produto: quando a rede cai, o
  sistema não supre a necessidade. Sem fila de escrita, sem banco local, sem
  sincronização.
- Node 22 (`lts/jod`), igual ao `wa-api`.
- Identificadores, arquivos, testes e comentários em inglês; documentação e
  texto de tela em português, conforme o CLAUDE.md.
- TDD sem exceção: teste vermelho primeiro, com a saída colada.

## Fatiamento

O front inteiro se divide em fatias independentes, cada uma com seu próprio
design e seu próprio plano. Este documento cobre a primeira.

| #   | Fatia                       | Conteúdo                                                                                |
| --- | --------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **Fundação, auth e papéis** | Projeto, camada HTTP, sessão, portão de permissão, casco, design system, CRUD de papéis |
| 2   | Usuários                    | CRUD de usuários, papel, permissões avulsas, situação, reset de senha                   |
| 3+  | Domínio operacional         | Catálogo, lançamentos, produção, vendas e relatórios, conforme o `wa-api` os expuser    |

A fatia 1 entrega uma tela de domínio de ponta a ponta de propósito: fundação
sem consumidor real é fundação não verificada.

## Decisão 1 — SPA React sobre Vite, sem servidor próprio

O `wa-web` é uma aplicação de página única em React 19 compilada por Vite 8,
publicada como arquivo estático. Toda comunicação é HTTP direto com o `wa-api`.

**Rails foi descartado** porque traria um segundo back end, com autenticação,
ORM e migrações próprios competindo com o Prisma e o modelo de permissões que já
existem e já foram testados.

**Next.js foi descartado** porque o valor dele é a camada servidora — SSR,
server actions, cache no servidor — e contra uma API Fastify separada essa
camada vira um proxy: um salto de rede a mais, um processo Node a manter em
produção e o modelo mental duplo de server/client components, tudo para servir
telas atrás de login, que não têm SEO nem ganho real de primeira pintura.

**Vue e Svelte foram considerados e não escolhidos.** Ambos têm teto de
desempenho igual ou melhor, e nenhum dos três seria o gargalo: em telas de
registro e listagem o que derruba o desempenho percebido é sempre a mesma lista,
independente de framework — número de requisições por tela, cache sem
invalidação correta, lista longa sem virtualização, bundle sem divisão por rota
e formulário que revalida o mundo a cada tecla. O critério de desempate foi
quanto trabalho já vem pronto: é no ecossistema React que tabela, formulário,
diálogo acessível e cache de estado de servidor estão resolvidos com qualidade,
e é o único caminho em que a encarnação anterior do `wa-web` — auth, refresh,
guarda de permissão, precificação — continua legível no histórico do git como
referência.

## Decisão 2 — o contrato com a API é gerado, nunca escrito à mão

Nenhum tipo de requisição ou resposta do `wa-api` é digitado no `wa-web`. O
contrato é gerado por `openapi-typescript` a partir do documento OpenAPI, e o
resultado é a única fonte de verdade sobre a forma dos dados. Um campo que muda
no back tem que quebrar o `tsc` do front, não a tela do operador.

O `wa-api` monta o OpenAPI em runtime via `@fastify/swagger` e não versiona o
documento. **Com autorização explícita do dono do projeto, e limitada a isto**,
o `wa-api` ganha um script que serializa o documento para um `openapi.json`
commitado. O `wa-web` gera os tipos a partir do arquivo, sem precisar da API no
ar nem do banco de pé — a geração de tipos não pode depender de infraestrutura
rodando, ou ela deixa de rodar.

O arquivo gerado no `wa-web` é versionado. Uma mudança de contrato aparece no
diff, que é onde ela deve ser discutida.

## Decisão 3 — sessão: token curto em memória, rotação sob trava

O `wa-api` devolve o par de tokens no corpo da resposta, então não há cookie
`httpOnly` disponível e guardar os tokens é responsabilidade do front.

### Onde cada token vive

O **access token** fica apenas em memória. O **refresh token** fica em
`localStorage`. Ao carregar a aplicação, o front chama `POST /v1/sessions/refresh`
para reidratar a sessão.

A justificativa principal não é segurança: o refresh token é a credencial forte
e precisa persistir de qualquer modo para a sessão sobreviver a um F5, então ele
está em `localStorage` em qualquer desenho que atenda ao requisito. A defesa real
contra XSS é CSP e não injetar HTML, e isso entra no projeto de qualquer forma.
A justificativa é estabilidade: este desenho faz o caminho de refresh rodar em
**todo** carregamento, então ele nunca vira um trecho raramente exercitado que só
falha às três da tarde, no tablet, no meio do turno.

### A renovação é serializada, inclusive entre abas

Este é o ponto mais delicado da fatia, pelo comportamento de revogação em cadeia
descrito no Problema.

Dentro de uma aba, o cliente HTTP faz **voo único**: a primeira resposta `401`
dispara um refresh, as demais requisições que falharem enquanto ele estiver em
voo entram numa fila, e todas são repetidas com o token novo quando ele chega.
Quatro chamadas paralelas produzem um refresh, não quatro.

Entre abas, voo único por aba não basta: duas abas rotacionam ao mesmo tempo, a
perdedora replica um token já rotacionado e o back derruba a conta inteira. A
renovação roda dentro de uma trava da Web Locks API
(`navigator.locks.request`), e a regra que a torna segura é uma só: **o refresh
token é lido do armazenamento dentro da trava**, nunca capturado antes de
esperar por ela. Se outra aba já rotacionou enquanto esta aguardava, o que se lê
é o par novo — ainda não usado — e a renovação segue com ele, sem replay.
Publicar o par pelo evento `storage` depois do fato não resolveria: a corrida
está entre ler o token e enviá-lo, não depois de recebê-lo.

Dentro da mesma aba há um atalho a mais: quem entra na trava e encontra em
memória um access token diferente do que falhou sabe que outra requisição desta
aba já renovou, e o reaproveita em vez de renovar de novo.

**A trava exige contexto seguro.** `navigator.locks` só existe sob HTTPS ou
`localhost`. Servido em HTTP puro na LAN — condição normal num escritório
pequeno, não exótica — a serialização entre abas desaparece e a revogação em
cadeia volta. O código degrada para uma fila interna à aba e avisa no console,
mas **servir o `wa-web` por HTTPS é requisito de implantação**, não recomendação.

**Nem toda falha no refresh encerra a sessão.** Só o `wa-api` respondendo `401`
ou `403` à rotação significa "este token não é mais seu": aí a sessão é limpa e
o usuário vai para o login, uma vez, sem laço. Um `502` de API reiniciando ou
uma falha de rede deixam o refresh token onde está e viram nova tentativa —
descartar a sessão nesses casos forçaria um relogin que o servidor não pediu.

### Ciclo de vida

- **Entrar:** `POST /v1/sessions/signin` guarda o par e busca `GET /v1/sessions/me`.
- **Reidratar:** no boot, refresh sob trava; sucesso segue para a rota pedida,
  falha vai para o login.
- **Sair:** `POST /v1/sessions/signout` com o refresh token, e a limpeza local
  acontece mesmo se a chamada falhar — sair tem que sair.

## Decisão 4 — a autorização do front é espelho, nunca autoridade

`GET /v1/sessions/me` devolve as permissões efetivas do usuário, já somadas pelo
back. O front guarda essa lista e a usa para duas coisas: `RequireSession`
protege o que exige login, e `RequirePermission` compara a permissão exigida pela
rota com a lista e desvia para a tela de acesso negado.

O objetivo é não oferecer ao operador um botão que vai responder `403`. A
autoridade continua sendo o `wa-api`, que declara a permissão em cada rota e
recusa por conta própria. Consequência prática: **`403` é resposta legítima, não
defeito** — a interface a trata como estado previsto, sem tela de erro genérica e
sem relatar bug.

## Decisão 5 — o estado do servidor tem um dono só

TanStack Query é o único guardião de tudo que veio do `wa-api`. Nada disso é
copiado para `useState`: copiar é o que produz duas telas mostrando números
diferentes do mesmo registro.

- Cada fatia declara suas chaves (`["roles"]`, `["roles", id]`) no seu próprio
  módulo, e cada mutação invalida exatamente as chaves que sujou.
- `staleTime` é declarado por tipo de dado, e o refetch ao focar a janela fica
  desligado onde não faz sentido. O padrão da biblioteca revalida a cada foco;
  num tablet que troca de aplicativo o tempo todo, isso vira uma rajada de
  requisições que o operador percebe como travamento.
- Estado de formulário e estado de interface não moram no cache: são locais à
  tela, com `react-hook-form` e `useState`.

## Estrutura do projeto

Fatias verticais. Cada fatia é dona do seu acesso à API, dos seus schemas de
formulário, dos seus rótulos em português, das suas páginas e dos seus testes.
Uma fatia nunca importa o interior de outra; o que duas precisam sobe para `lib`
ou `components`.

```
src/
  app/            router, providers, boot da sessão
  components/
    layout/       casco: cabeçalho, navegação, área de conteúdo
    ui/           vocabulário visual: botão, campo, diálogo, tabela
    common/       estados compartilhados: erro de consulta, confirmação, cabeçalho de página
  features/
    auth/         login, sessão, guardas, rótulos de permissão
    roles/        CRUD de papéis
  lib/            cliente HTTP, tipos gerados da API, ambiente
```

Arquivo grande é sinal de responsabilidade demais, e vira gatilho de divisão, não
de tolerância.

## Camada visual

Tailwind 4 pelo plugin oficial do Vite, e componentes acessíveis cujo código
fonte fica no repositório (padrão shadcn sobre Base UI), em vez de uma biblioteca
cujo design system se adota inteiro. O conjunto inicial é o mínimo que a fatia
exige: botão, campo, rótulo, caixa de seleção, tabela, diálogo, diálogo de
confirmação, selo e aviso temporário.

Alvo de toque de 44px e layout que funciona em tela pequena são requisito desde a
primeira tela, não adaptação posterior: o chão de fábrica usa tablet.

## Tratamento de erro

Um cliente HTTP só, e toda resposta fora da faixa 2xx vira um `ApiError` com
status e corpo já interpretado. Daí em diante o tratamento é por status:

| Status             | Tratamento                                                                           |
| ------------------ | ------------------------------------------------------------------------------------ |
| 401                | Caminho de refresh sob trava; falhando, limpa a sessão e vai ao login                |
| 403                | Tela de acesso negado; estado previsto, não erro                                     |
| 404, 409           | Sobe para o campo do formulário que causou                                           |
| 5xx, falha de rede | Nova tentativa com espera crescente; persistindo, estado de erro com ação de repetir |

**A mensagem da API não vai para a tela.** O `wa-api` responde em inglês
(`"Invalid credentials."`, `"Nothing to update."`) e a interface é em português.
Cada fatia traduz status mais contexto para a frase que o operador lê.

Toda tela está sempre em um de três estados — carregando, com dado, ou com erro e
uma saída. Tela em branco e erro engolido em silêncio não são estados válidos.
Um limite de erro por rota impede que uma falha de renderização derrube a
aplicação inteira.

## Ambiente e scripts

A base da API vem de `VITE_API_BASE_URL`, lida e validada por Zod num módulo só,
que falha alto no boot se faltar. Nenhum `import.meta.env` espalhado pelo código.

| Script            | Papel                                                |
| ----------------- | ---------------------------------------------------- |
| `dev`             | Vite em modo desenvolvimento                         |
| `build`           | `tsc -b` e build de produção                         |
| `test`            | Vitest, uma passada                                  |
| `test:watch`      | Vitest em observação                                 |
| `api:types`       | Gera os tipos a partir do `openapi.json` do `wa-api` |
| `lint:prettier:*` | Verificação e correção de formatação                 |

Husky e commitlint iguais aos dos outros repositórios, para que a convenção de
commit valha aqui também.

## Testes

Vitest, Testing Library e MSW, com os handlers do MSW **tipados pelos mesmos
tipos gerados do OpenAPI** — um mock que mente sobre o contrato não compila, que
é o que impede a suíte de ficar verde contra uma API imaginária.

O teste exercita comportamento pela interface, com `user-event`. Lógica pura —
rótulo de permissão, montagem de payload, formatação — é testada direto, sem
renderizar.

Três coisas ganham teste próprio por serem o maior risco da fundação:

1. **Voo único do refresh:** várias requisições tomando `401` ao mesmo tempo
   resultam em **um** refresh, e todas são repetidas com o token novo.
2. **Trava entre abas:** quem espera na trava e encontra o token já rotacionado
   adota o par novo e **não** dispara refresh.
3. **Guarda de permissão:** rota negada não renderiza a tela nem dispara a
   requisição.

## Escopo da entrega

**Fundação:** projeto Vite com TypeScript estrito; cliente HTTP com `ApiError`,
refresh de voo único sob trava e fila de repetição; sessão com token curto em
memória e reidratação no boot; `RequireSession` e `RequirePermission`; casco com
navegação filtrada por permissão; conjunto mínimo de componentes; tipos gerados
do `openapi.json`; ambiente validado; suíte de testes configurada.

**Telas:** login, troca da própria senha, acesso negado, erro de rota.

**Domínio — papéis:** listar, criar, editar e excluir papéis, com seleção
múltipla de permissões e confirmação de exclusão. É o único CRUD completo da API,
e exercita lista, formulário, diálogo, exclusão e invalidação de cache com escopo
pequeno.

**No `wa-api`, e só isto:** o script que serializa o OpenAPI e o `openapi.json`
versionado.

## Riscos assumidos

- **Revogação em cadeia.** A trava resolve as abas do mesmo navegador. Dois
  navegadores ou dois dispositivos com a mesma conta continuam podendo derrubar
  um ao outro, porque a trava é local à origem. Aceito nesta fatia: o uso
  previsto é uma conta por pessoa. Se aparecer conta compartilhada entre
  dispositivos, o conserto é no `wa-api`, com janela de tolerância na rotação.
- **HTTPS é requisito, não preferência.** Sem contexto seguro não há
  `navigator.locks`, e sem ele a serialização entre abas cai. O `wa-web`
  servido em HTTP puro na LAN reintroduz a revogação em cadeia, com degradação
  anunciada no console e nada mais.
- **Refresh token em `localStorage`.** Um XSS lê a credencial forte. Mitigado por
  CSP e pela regra de nunca injetar HTML, não pelo local de armazenamento —
  enquanto o back entregar o token no corpo, não há alternativa que preserve a
  sessão após um F5.
- **Sem offline.** Rede caída no chão de fábrica significa operador parado. Foi
  decisão explícita do dono do produto, tomada com o custo à vista.

## Fora de escopo

Offline e sincronização. Virtualização de lista e React Compiler — otimizações
legítimas, sem problema medido para resolver hoje; entram quando um número pedir,
com o número no commit. Telas de usuários e do domínio operacional. Tema escuro.
Internacionalização.

## Achados no `wa-api`, relatados e não consertados

- **`GET /v1/roles` e `GET /v1/users` devolvem array sem paginação.** Funciona
  para dezenas de registros e não funciona para milhares. Quando chegar uma
  listagem de volume operacional — lançamentos, produção, vendas — a paginação
  precisa nascer no back, não ser contornada no front.
- **O documento OpenAPI não é versionado.** Tratado nesta fatia, dentro da
  autorização recebida.
