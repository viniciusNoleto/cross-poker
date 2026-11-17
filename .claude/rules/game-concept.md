# Cross Poker — Conceito e Arquitetura do Jogo

Este arquivo é a fonte de verdade para qualquer trabalho relacionado à lógica do jogo (sala, partida, mesa, bolo, troca, compra, pontuação, animações). As regras originais do jogo estão documentadas no `README.md` (raiz do projeto) — leia-o também se precisar do texto original. Este documento traduz essas regras em decisões de implementação e fixa o vocabulário/nomenclatura que **todo** código deve seguir.

Este projeto foi criado a partir do `~/personal/white-label-inventory-system` (mesma arquitetura Next.js + Drizzle + TanStack Query + Mantine + Tailwind), mas é um produto totalmente diferente: um **jogo de cartas online para jogar com amigos**, baseado num jogo de baralho tradicional em duplas com mecânicas inspiradas em Balatro. **Ignore qualquer estilo visual do sistema antigo** (StockFlow / inventário) — a identidade visual deste projeto é a de um jogo de cartas: mesa de jogo, cartas com animações ao virar/mover/comprar/jogar, deve ser bonito e "tátil".

---

## 1. Vocabulário oficial e mapeamento para o código

Os termos abaixo são nomes de mecânicas específicas do jogo. Continue usando os termos em português na conversa, no `README.md` e neste documento — são o vocabulário conceitual do jogo. **No código** (rotas, tabelas, enums, interfaces, nomes de arquivo), porém, use os nomes em inglês da coluna "Código" — essa tradução foi uma decisão deliberada para manter o código em inglês; apenas texto voltado ao usuário final (labels, botões, mensagens) continua em português.

| Termo (conceito) | Código (EN) | Significado |
|---|---|---|
| **Partida** | `Game` | Uma rodada completa do jogo, disputada por 4 jogadores em 2 duplas. |
| **Sala** | `Room` | Lobby onde jogadores se reúnem antes da Partida começar (conceito de infraestrutura, não está no texto original de regras do `README.md`). |
| **Monte** | `Deck` | Pilha de compra, com as cartas remanescentes após a distribuição inicial (viradas para baixo). |
| **Jogada** (antes "Mesa") | `Meld` | Ação de pontuação: usar 1 a 5 cartas da mão para formar a melhor combinação válida. Também é o nome do **token** "usar 1 Jogada" (cada jogador começa com 5). Não usamos `Play`/`Table` no código: `Play` colide com o verbo genérico já usado nos nomes de serviço (`play{Ação}Service`, ex. `playMeldService`/`playDiscardService`), e `Table` colidiria com `UtilsTable`/"tabela do banco". |
| **Descarte** (antes a ação "Bolo") | `Discard` | (1) **Ação/token**: descartar 1 a 5 cartas e repor (cada jogador começa com 5). (2) **Pilha** do Descarte: as cartas descartadas, viradas para baixo — é uma origem de compra (coluna `games.discard`). |
| **Bolo** | `MeldPile` (`meld_pile`) | **Pilha** das cartas usadas em Jogadas, viradas para cima, à vista de todos. **Não é origem de compra** — só volta ao jogo quando o Monte acaba (ver decisão 1). Não é mais uma ação. |
| **Troca** | `Swap` | Ação alternativa ao Descarte: troca secreta de cartas entre parceiros de equipe. Consome 1 Descarte de cada parceiro. |
| **Compra** | `Draw` | Ato de comprar cartas do Monte ou do Descarte (nunca do Bolo) — sempre parte de uma Jogada ou de um Descarte, nunca uma ação de turno independente. |
| **Combinação** | `Combo` | Classificação da Jogada (Par, Flush, Full House etc). |
| **Equipe** | `Team` | Dupla de 2 jogadores sentados em posições opostas. |
| **Carta** | `Card` | Naipe (`Suit`) + Valor (`Rank`) + Chips. O jogo usa 1 baralho (52 cartas, cada carta física é uma instância única). |
| **Naipe** | `Suit` | copas/ouros/paus/espadas → hearts/diamonds/clubs/spades (também os valores do enum e o formato do id de carta, ex. `"hearts-A-1"`). |
| **Valor** | `Rank` | A..K (os valores string do enum permanecem 'A','2'..'10','J','Q','K'). |
| **Chips** | `Chips` | Valor numérico de pontuação base de uma carta ou de uma Jogada. |
| **Multiplicador** | `Multiplier` | Fator aplicado aos Chips somados de uma Jogada, conforme a combinação formada. |

---

## 2. Regras do jogo (resumo operacional)

Ver `README.md` para o texto integral das regras originais. Pontos que a implementação precisa respeitar à risca:

- 4 jogadores, 2 duplas, sentados em posições opostas (assentos 0-3; equipe A = assentos {0,2}, equipe B = assentos {1,3}).
- Ordem de turno: sentido horário (0→1→2→3→0...), o que já alterna equipes automaticamente a cada turno.
- Início: cada jogador recebe 8 cartas na mão, 5 Jogadas, 5 Descartes. O resto forma o Monte (embaralhado).
- Três pilhas na mesa: **Monte** (compra, virado para baixo), **Bolo** (cartas das Jogadas, viradas para cima, não se compra) e **Descarte** (cartas descartadas, viradas para baixo, compra-se do topo).
- No turno, o jogador faz **exatamente uma** ação: Jogada, Descarte, ou Troca (Troca substitui um Descarte, não é uma terceira opção independente).
- Jogador sem nenhuma ação disponível (0 Jogadas **e** 0 Descartes) é pulado na ordem de turnos.
- **Jogada**: consome 1 Jogada; joga 1 a 5 cartas da mão; o jogo identifica automaticamente a melhor combinação válida entre as cartas jogadas; só as cartas da combinação pontuam; todas as cartas jogadas (pontuando ou não) vão para o **Bolo** viradas para cima — **só depois da compra** (ver abaixo); o jogador compra até voltar a 8 cartas na mão, de uma única origem (Monte OU Descarte, nunca misturado na mesma compra, nunca do Bolo). **A origem é escolhida junto com a jogada, numa única ação — ver "Compra junto com a ação" na seção 3.**
- **Descarte**: consome 1 Descarte; descarta 1 a 5 cartas da mão (vão para a pilha do **Descarte** viradas para baixo, **só depois da compra** — ver abaixo); compra a mesma quantidade, de uma única origem (Monte OU Descarte). **Mesma observação: a origem é escolhida junto com o descarte — ver "Compra junto com a ação" na seção 3.**
- **Troca**: o jogador declara quantas cartas quer trocar (1-5); ambos os parceiros precisam ter ≥1 Descarte; cada um escolhe secretamente essa quantidade de cartas; a troca é simultânea; ninguém mais vê o conteúdo; cada participante consome 1 Descarte; **não há compra** após a troca.
- Fim da Partida (checar ao fim de todo turno — `gameEndReason` em `models/Turn.ts`; motivo gravado em `games.finish_reason`, enum `EFinishReason`):
  - `no_melds`: **nenhum jogador** possui Jogadas restantes (pode acontecer com jogadores ainda tendo Descartes, o jogo acaba mesmo assim);
  - `decided` (fim antecipado): **só uma equipe** ainda tem Jogadas **e** ela já está **estritamente na frente** — a outra não pontua mais, o resultado não pode mudar. Enquanto só uma equipe tiver Jogadas e estiver atrás/empatada, a tela da partida mostra um aviso explicando que o jogo acaba assim que ela passar à frente;
  - `inactivity`: mais de **1 hora** sem nenhuma ação (`games.last_action_at`) — encerrada pela rotina `libs/staleGames.ts`, vale o placar do momento.
- Pontuação da dupla = soma da pontuação dos dois integrantes. Maior pontuação vence; totais iguais = empate (`winning_team = null`).

### Combinações e pontuação (igual ao Balatro)

- Tamanho variável (1 a 5 cartas jogadas, encontra a melhor combinação numa subseleção): Carta Alta, Par, Dois Pares, Trinca, Quadra.
- Exigem exatamente 5 cartas jogadas para serem possíveis: Sequência, Flush, Full House, Straight Flush.
- Pontuação = (soma dos Chips das cartas que compõem a combinação) × Multiplicador da combinação. Cartas jogadas fora da combinação não pontuam, mas ainda vão para o Bolo.

| Mão | Chips Base | Multiplicador |
|---|---:|---:|
| Carta Alta | 5 | ×1 |
| Par | 10 | ×2 |
| Dois Pares | 20 | ×2 |
| Trinca | 30 | ×3 |
| Sequência | 30 | ×4 |
| Flush | 35 | ×4 |
| Full House | 40 | ×4 |
| Quadra | 60 | ×7 |
| Straight Flush | 100 | ×8 |

> Nota de leitura: "Chips Base" da mão citada na tabela é o valor de partida do multiplicador Chips do Balatro; some a ele os Chips das cartas da combinação antes de multiplicar (`(chips_base + soma_chips_cartas) × multiplicador`), seguindo fielmente o sistema Balatro.

| Carta | Chips |
|---|---:|
| Ás | 11 |
| Rei / Dama / Valete / 10 | 10 |
| 9..2 | valor de face |

### Decisões assumidas (regras não 100% explícitas no texto original de regras do `README.md` — mantenha consistência com isto em todo o projeto; se o usuário corrigir, atualize este arquivo)

1. **Esgotamento do Monte**: se uma compra do Monte precisar de mais cartas do que ele tem, embaralhe **todas** as cartas do **Bolo** formando um novo Monte, e continue a compra. O Bolo fica vazio depois disso; o Descarte não é mexido (continua sendo uma origem de compra própria).
2. **Compra a partir do Descarte**: o Descarte é uma pilha (LIFO) — comprar dele compra as N cartas do topo, na ordem em que foram colocadas. Todas estão viradas para baixo: a identidade só é revelada ao jogador que compra. O Bolo nunca é origem de compra.
3. **Primeiro jogador da Partida**: sorteado aleatoriamente entre os 4 assentos quando a Partida começa (não especificado no texto original de regras do `README.md`).
4. **Dono da Sala (host)**: o jogador que cria a Sala. Só ele pode iniciar a Partida, e apenas quando houver exatamente 4 jogadores presentes.
5. **Compra insuficiente mesmo após esgotamento**: se, mesmo depois de aplicar as regras acima (reembaralhar o Bolo no Monte quando a origem é Monte), ainda não houver cartas suficientes para completar a `quantidade` pedida, a compra entrega **o quanto houver disponível** (podendo ser até 0 cartas) e para silenciosamente — sem lançar erro. A camada de API decide o que fazer com uma mão que ficou abaixo de 8 cartas (normalmente nada: aguarda a próxima compra dar mais cartas ao jogador).

---

## 3. Decisões técnicas

### Stack (herdado do projeto base, mantido)
Next.js (App Router, Route Handlers) + Drizzle ORM + PostgreSQL + TanStack Query + Mantine (componentes de base, tema visual será totalmente customizado) + Tailwind + Yup + i18next (pt-br, es-mx, en-us).

### Identidade do jogador — sem login
Não há sistema de contas. Um jogador entra numa Sala informando um **apelido** + o **código da Sala**. Ao entrar, o servidor cria um registro `room_players` com um `session_token` (uuid) opaco e devolve um cookie **httpOnly**, `sameSite=lax`, nome `cp_session_{room_code}`, valor = `session_token`. Toda rota que precisa saber "quem é o jogador fazendo a requisição" lê esse cookie e busca o `room_players` correspondente — nunca confie em um `player_id` vindo do body/query. Isso também é o que impede um jogador de ver a mão de outro: o servidor só devolve a mão do jogador dono da sessão.

### Tempo real — Server-Sent Events
Cada cliente conectado a uma Sala/Partida abre um stream SSE em `app/api/rooms/[code]/stream/route.ts` (lobby) ou `app/api/games/[gameId]/stream/route.ts` (partida). O servidor mantém um **pub/sub em memória** (um `EventEmitter`/registro de `ReadableStreamDefaultController` por sala/partida, singleton do processo Node) — quando uma ação muda o estado, publica um evento `state-changed` para todos os streams daquela sala/partida; cada stream, ao receber o evento, busca e envia (via SSE) o snapshot **personalizado** daquele jogador (nunca inclui mãos alheias). Não há Redis/infra nova — suficiente para o volume de um jogo entre amigos rodando num único processo. Se um dia precisar escalar horizontalmente, o pub/sub em memória precisaria virar Redis pub/sub — não implementar isso agora, apenas manter a interface do publisher isolada (`libs/realtime.ts`, que reexporta `libs/realtimeHub.ts` — o registro de canais fica em `globalThis` para a rotina de inatividade, que roda fora do grafo dos Route Handlers, publicar nos mesmos streams) para facilitar essa troca futura.

### Feed de "última ação" (para as animações)

`IGameState.last_action` (`IPublicLastAction`, em `resources/game/models/GameState.ts`) expõe a última linha de `game_actions` da Partida, já filtrada por privacidade, calculada em `GET /api/games/[gameId]` (`app/api/games/[gameId]/route.ts`) — **não reimplemente essa busca em nenhuma rota nova**, ela já roda em toda chamada ao snapshot.

- Todo snapshot traz o MESMO `last_action` até que uma nova ação aconteça — o cliente usa o campo `id` (id da linha em `game_actions`) para saber se já reagiu a ela (guarde o último `id` visto, ex. num `useRef`, e só dispare a animação quando `id` mudar).
- **Redação de privacidade** (importante — não vaze a mão de ninguém através disso): cartas que ainda são privadas (as compradas, sempre; as descartadas no Descarte, porque ficam viradas para baixo) só vêm preenchidas quando `seat` da ação é o SEU PRÓPRIO assento. Para os outros jogadores vendo a ação de alguém, só a CONTAGEM aparece (`drawn_count`/`discarded_count`), nunca a identidade — a animação de "outros jogadores vendo alguém comprar/descartar" deve desenhar cartas viradas para baixo (`<Card card={null} />`), não os valores reais. Já as cartas de uma Jogada (`melded_cards`/`scoring_cards`) são sempre públicas (vão para o Bolo viradas para cima, todo mundo já vê o valor ali mesmo) — a animação de Jogada pode mostrar os valores reais para todos.
- `type` diz qual animação disparar (`'meld' | 'discard' | 'swap'` — Compra nunca aparece como `type` isolado, ela sempre é parte do payload de uma Jogada/Descarte via `draw_source`/`drawn_count`, já que acontece na mesma ação/requisição — ver "Compra junto com a ação" acima).

### Organização de módulos (`resources/`)
Segue `file-organization.md`. Os nomes de módulo e de arquivo estão em inglês (ver seção 1 para o mapeamento PT↔EN):

```
resources/
├── room/                  # lobby: criar/entrar/listar/iniciar
│   ├── enums/
│   ├── models/
│   ├── services/
│   ├── logics/
│   └── fragments/
└── game/                   # jogo em andamento
    ├── enums/               # ESuit, ERank, EActionType, EDrawSource, EGameStatus, ECombo, ETeam
    ├── models/              # Card, Deck, Combo, Draw, Team, Turn, GameState, Swap
    ├── services/            # getGameService, playMeldService, playDiscardService, startSwapService, chooseSwapService
    ├── logics/              # PlayMeld, PlayDiscard, PlaySwap
    ├── components/          # Card, DiscardPile, Scoreboard, ComboReference, animações
    └── hooks/               # useAnimatedLastAction
```

### Modelo de dados (Drizzle — `db/schema/`)

- `rooms`: id (serial), code (varchar único, curto, ex. 6 chars), status (`waiting|playing|finished`), created_at.
- `room_players`: id, room_id (fk), name, seat (0-3, único por sala), session_token (uuid, único), is_host (bool), connected_at, created_at.
- `games`: id, room_id (fk), status (`playing|finished`), current_seat (0-3), deck (Monte — jsonb, array de ids de carta, ordem = fundo→topo; **o topo, próxima carta a comprar, é o ÚLTIMO elemento do array** — use `.pop()`, nunca `.shift()`), discard (Descarte — jsonb, array de ids de carta viradas para baixo, mesma convenção), meld_pile (Bolo — jsonb, array de ids de carta viradas para cima, mesma convenção), pending_swap, winning_team (`A|B`|null — null também em empate), finish_reason (`EFinishReason`: `no_melds|decided|inactivity`, null enquanto joga), last_action_at (última ação de qualquer jogador — usado pela rotina de inatividade), created_at, finished_at. Ao encerrar, a Sala vai para `finished` (helper `libs/gameFinish.ts`).
- `game_players`: id, game_id (fk), seat (0-3), hand (jsonb array de ids de carta — **nunca exposto a outros jogadores via API**), melds_remaining (int, default 5), discards_remaining (int, default 5), score (int, default 0).
- `game_actions`: id, game_id (fk), seat, type (`meld|discard|swap|draw`), payload (jsonb — detalhes da jogada, usado tanto para histórico quanto para as animações saberem o que aconteceu), created_at.

Carta é representada como um objeto `{ id, suit, rank }` (chips derivado de `rank` via tabela fixa, nunca persistido redundantemente). `id` de carta é único por instância física (ex.: `"hearts-A-1"` para o Ás de Copas do baralho único).

### Compra junto com a ação (uma única requisição)

Decisão de UX (não é uma regra do texto original de regras do `README.md`): na interface, Jogada e Descarte são feitos em dois cliques — o jogador seleciona as cartas, clica em **Jogada**/**Descarte** e então escolhe a origem da compra (Monte ou Descarte) em `resources/game/components/DrawSourcePicker.tsx` (com **Cancelar**; a seleção da mão fica travada enquanto isso). **Nada é enviado ao servidor antes da escolha da origem**: cartas + origem vão numa **única requisição** (`POST .../meld` ou `POST .../discard`, body `{ cards, source: 'deck'|'discard' }`).

Motivo: antes era um fluxo em duas requisições (`pending_draw` + `POST .../draw`), e a pontuação da Jogada ficava visível para os outros jogadores antes de o autor terminar a jogada. Agora a pontuação, a linha em `game_actions` e o `publish` só existem quando a ação inteira está concluída, e **a animação de pontuação toca para todos (inclusive o autor) ao mesmo tempo**, via `last_action` + SSE. Não reintroduza um estado intermediário visível (`pending_draw` foi removido, migration `0002_drop_pending_draw`).

No servidor, as duas rotas usam `libs/actionDraw.ts`:
- `drawSourceError(game, source, quantity)` — valida a origem com `drawSourceAvailability` (`models/Draw.ts`, mesma função usada no cliente): Descarte só é válido se `discard_count >= quantity`; Monte é válido se `deck_count + meld_pile.length >= quantity` (o Bolo é reembaralhado no Monte se faltar) ou se o Descarte também não der conta.
- `resolveActionWithDraw(...)` — numa transação: chama `drawCards` e **só depois** empilha as cartas da ação no topo do Bolo (Jogada) ou do Descarte (Descarte), então o jogador nunca compra de volta o que acabou de jogar/descartar; atualiza a mão e os contadores/pontuação; grava a linha em `game_actions`; roda o checklist de fim-de-turno de `Turn.ts` (`finishGame` ou próximo assento). A rota chama `publish` depois.

### Animações — biblioteca `motion` e o hook `useAnimatedLastAction`

Instalada a lib `motion` (sucessora do Framer Motion, `import { motion, AnimatePresence } from 'motion/react'`) — é a única dependência de animação do projeto, não instale outra.

- `resources/game/components/Card.tsx` já é um componente `motion` (`motion.div`/`motion.button` com `layout` ativo) e aceita uma prop opcional `layoutId`. Duas `<Card>` com o mesmo `layoutId`, mesmo em partes diferentes da árvore/tela, animam a transição de posição/tamanho entre elas automaticamente — é o mecanismo certo para "carta voando" de uma pilha pra outra (ex.: do Monte pra mão, da mão pro Bolo) sem calcular posição manualmente. Para a carta desmontar de um lugar e montar em outro dentro da mesma transição, envolva a região com `<AnimatePresence>`.
- `resources/game/hooks/useAnimatedLastAction.ts` (pasta nova, mesmo motivo de `components/` — ver nota abaixo): `const { newAction, clear } = useAnimatedLastAction(state.last_action)`. Dispara (`newAction` deixa de ser `null`) só quando chega uma ação com `id` diferente do último já visto — evita cada camada de animação reimplementar esse controle. `newAction` fica preenchida até você mesmo chamar `clear()` quando sua animação terminar de tocar.
- **Várias animações reagem à MESMA `last_action`, sem conflito** — elas são camadas visuais independentes: uma Jogada gera uma única linha em `last_action` com `type: 'meld'`, mas ela carrega tanto os dados da pontuação (`combo`/`chips`/`multiplier`/`points`, para a animação de contagem de pontos) quanto os dados da compra que a conclui (`draw_source`/`drawn_count`/`drawn_cards`, para a animação de compra) — cada camada olha só os campos que lhe interessam e ignora o resto. Idem para `type: 'discard'` (descarte + compra) e `type: 'swap'`.
- **Todas as animações usam só `last_action`, inclusive para o autor** — `POST .../meld`/`.../discard` retornam `data: null`; não crie atalho local para o autor, senão ele volta a ver a animação antes dos outros (ver "Compra junto com a ação" acima). Enquanto a contagem de pontos de uma Jogada está na tela, a página desconta esses pontos do placar/assentos (`displayedPlayers` em `app/games/[gameId]/page.tsx`, liberado por `onScoreCounted` de `MeldScoreAnimationLayer`), para o placar só subir quando a contagem termina. Pelo mesmo motivo, durante a contagem a **vez continua mostrada em quem jogou** (`scoreCounting` → `shownTurnSeat`/`turnKey` na página): a ficha de vez, os anéis, o "Sua vez", os botões de ação e o som de vez só passam ao próximo assento quando a contagem termina, para não sobrepor sons e acontecimentos.
- Cada subagente de animação constrói sua própria camada (componente que recebe `state: IGameState` e renderiza sua própria sobreposição/efeito) mas **não edita `app/games/[gameId]/page.tsx`** — a integração de todas as camadas de animação é feita numa passada só, depois que todos terminarem, para evitar concorrência de edição no mesmo arquivo.

### Formato de API
Segue `api-response-format.md` (envelope `{ success, message, data }`, chaves snake_case) e `resources-services.md` para os arquivos de `services/`.

---

## 4. Roadmap deste projeto (para dar contexto do que já existe / o que falta)

1. ✅ Sala (lobby): criar/entrar/iniciar Partida com 4 jogadores.
2. ✅ Ambiente de Partida: mão privada, contadores públicos de Jogadas/Descartes, turno, stream SSE.
3. ✅ Ação de Jogada (jogar combinação + pontuar) — `resources/game/models/Combo.ts` + `app/api/games/[gameId]/meld`.
4. ✅ Ação de Descarte (descartar + comprar) — `app/api/games/[gameId]/discard`.
5. ✅ Ação de Troca (troca secreta entre parceiros, fluxo em duas fases com transação) — `app/api/games/[gameId]/swap/{start,choose}`.
6. ✅ Compra de cartas (Monte/Descarte) como estrutura compartilhada — `resources/game/models/Draw.ts`.
7. ✅ **Compra junto com a ação** (Jogada/Descarte + origem da compra numa única requisição — ver seção 3, "Compra junto com a ação") — `libs/actionDraw.ts`, `resources/game/components/DrawSourcePicker.tsx`. Substituiu o antigo fluxo em duas fases (`pending_draw` + `POST .../draw`).
8. ✅ **Exibição de pontuação**: animação de pontuação (item 12) + `resources/game/components/Scoreboard.tsx` (placar agregado por dupla, sempre visível).
9. ✅ **Bolo e Descarte na mesa**: `resources/game/components/MeldPile.tsx` (Bolo — clique abre a lista de cartas; hover só desenha um ring dourado em volta do grupo) e `resources/game/components/DiscardPile.tsx` (Descarte — pilha virada para baixo, só a contagem).
10. ✅ **Botão de consulta de mãos**: `resources/game/components/ComboReference.tsx` (`ComboHelpButton`).
11. ✅ **Feed de "última ação"**: `IGameState.last_action` — ver seção 3, "Feed de última ação".
12. ✅ **Animação: pontuação da Jogada** — ÚNICA e IDÊNTICA para todos (ver "Animações" na seção 3): as cartas jogadas voam do assento de quem jogou até o centro do tabuleiro, só as cartas da combinação ficam em evidência (maiores, elevadas, com brilho — as demais pousam menores e apagadas), depois cada carta pontuando salta revelando seu valor de Chips (com um "+N" flutuante), soma a um contador, e por fim mostra o multiplicador e o total. Motor único: `resources/game/components/MeldScoreAnimation.tsx`, alimentado por `MeldScoreAnimationLayer.tsx` a partir de `last_action` para todos os jogadores (inclusive o autor), que assim veem a animação ao mesmo tempo.
13. ✅ **Animação: compra do Monte/Descarte** (cartas indo pra mão de quem comprou, todos os pontos de vista) — `resources/game/components/DrawAnimation.tsx`.
14. ✅ **Animação: Troca de Equipe** (todos os pontos de vista) — `resources/game/components/SwapAnimation.tsx`.
15. ✅ **Animação: Descarte** (cartas voando até a pilha do Descarte) — `resources/game/components/DiscardAnimation.tsx`.
16. ✅ **Renomeação**: Mesa → Jogada, Bolo (ação) → Descarte; três pilhas (Monte, Bolo, Descarte), compra só do Monte ou do Descarte.
17. ✅ **Fim de partida**: fim antecipado (`decided`) com aviso na tela, tela de resultado por equipe (`resources/game/components/GameResult.tsx`) e animação de encerramento com cartas e fichas voando (`resources/game/components/GameEndAnimation.tsx`).
18. ✅ **Sons estilo retrô ("32 bits")**, sintetizados com Web Audio (sem arquivos) — `utils/sound.ts` (`sounds.cardsPlayed`, `chipTick`, `chipRoll`, `yourTurn`, `allyTurn`, `opponentTurn`, `roulette`, `gameEnd`, `cardSelect`/`cardDeselect` (mão), `chooseMeld`/`chooseDiscard`/`chooseSwap` (botões de ação), `chooseDeck`/`chooseDiscardPile` (origem da compra), `chipDrop` (fichas caindo no `Scoreboard`), `swapCardAppear`/`swapCardVanish` (quantidade no modal da Troca), `swapDeal` (Troca confirmada — fase 1 e fase 2), `swapCardsFly` (cartas cruzando na `SwapAnimation`); Jogada própria acima de 500 pontos toca `roulette` no lugar de `chipRoll`) — cada som é distinto; os três sons de vez (`yourTurn`/`allyTurn`/`opponentTurn`) saem por um barramento próprio mais alto (`ALERT_VOLUME`) e abaixam a música por instantes (`duckGameMusic` em `utils/music.ts`) para se destacarem — + botão de mudo `resources/game/components/SoundToggle.tsx`. A vez de cada jogador também dispara um efeito de anéis dourados se afastando do assento (`TurnRipple` em `app/games/[gameId]/page.tsx`). O assento da vez não tem borda fixa: o marcador é uma ficha preta com a cruz do logo em dourado (`resources/game/components/TurnChip.tsx`, `layoutId="turn-chip"`) posta na frente do jogador (lado voltado ao centro da mesa), que desliza girando pela mesa até o próximo assento.
19. ✅ **Encerramento por inatividade**: `libs/staleGames.ts`, iniciado por `instrumentation.ts` (a cada 5 min encerra partidas com mais de 1h desde a última ação).

Itens 12-15 foram implementados por subagentes que leram este arquivo (em especial "Animações — biblioteca `motion`...", seção 3) e depois integrados numa passada única em `app/games/[gameId]/page.tsx`.

---

## 5. O que já existe (não reimplemente — reutilize)

### Infra / libs (`libs/`)

- `libs/session.ts` — `setRoomSessionCookie(roomCode, token)` / `getRoomSessionToken(roomCode)`. Cookie httpOnly por Sala.
- `libs/roomAuth.ts` — `getCurrentRoomPlayer(roomCode, roomId)`: resolve o `room_players` (colunas públicas) do cookie da requisição atual, ou `null`.
- `libs/gameAuth.ts` — `getCurrentGamePlayer(gameId)`: resolve `{ game, room, roomPlayer, gamePlayer }` a partir do cookie da Sala dona da Partida. **Use isto em toda rota de ação** (Meld/Discard/Swap/Draw) para descobrir quem está fazendo a requisição e comparar `game.current_seat === roomPlayer.seat` antes de aceitar qualquer jogada.
- `libs/realtime.ts` — `publish(channel)` / `subscribe(channel, listener)`, pub/sub em memória. Canais em uso: `` `room:${roomCode}` `` e `` `game:${gameId}` ``. **Toda rota que muda o estado de uma Partida deve chamar `publish(\`game:${gameId}\`)` no final**, senão os outros 3 jogadores só vêem a mudança no próximo refetch manual. Reexporta `libs/realtimeHub.ts` (estado em `globalThis`).
- `libs/database.ts` — o pool/Drizzle real, sem `server-only` (usado pela rotina de inatividade); `libs/db.ts` o reexporta com `server-only` para os Route Handlers — continue importando `@/libs/db` nas rotas.
- `libs/gameFinish.ts` — `finishGame(dbOrTx, { gameId, roomId, players, reason })`: grava status `finished`, `winning_team` (null em empate), `finish_reason`, limpa pendências e marca a Sala como `finished`. **Use isto em todo encerramento**, nunca reescreva o update à mão. Toda rota de ação também atualiza `games.last_action_at`.
- `libs/staleGames.ts` — rotina de inatividade (`closeStaleGames`/`startStaleGameSweeper`), iniciada uma vez por processo em `instrumentation.ts`.
- `utils/sound.ts` — efeitos sonoros retrô sintetizados (`sounds.*`) + `useSoundMuted`/`setSoundMuted` (preferência em `localStorage`). O áudio só toca depois da primeira interação do usuário (política dos navegadores).

### Banco (`db/schema/`)

Tabelas `rooms`, `room_players` (+ `roomPlayerPublicColumns`, nunca selecione `session_token` para o cliente), `games`, `game_players`, `game_actions` — ver seção 3 para as colunas. `game_actions` é escrita por cada ação (Meld/Discard/Swap/Draw) ao concluir, para dar suporte ao histórico e às animações (`payload` traz o suficiente para a animação saber o que desenhar, ex.: cartas jogadas, combinação formada, origem da compra).

### Módulo `resources/game/`

- `enums/`: `ESuit` (hearts/diamonds/clubs/spades), `ERank` (A..K), `EGameStatus`, `ETeam` (A/B), `EDrawSource` (deck/discard), `EActionType` (meld/discard/swap/draw), `ECombo` (high_card..straight_flush), `EFinishReason` (no_melds/decided/inactivity).
- `models/Card.ts`: `ICard`, `CHIPS_BY_RANK`, `chipsForCard(card)`, `cardById(id)` (reconstrói `ICard` a partir do id, ex. `"hearts-A-1"`), `RANK_ORDER` (ordem alta, sem considerar Ás baixo — ver seção 2, decisão 1 sobre sequência).
- `models/Deck.ts`: `buildDeck(deckCount = 1)`, `shuffle(items)` (Fisher-Yates genérico).
- `models/Team.ts`: `teamForSeat(seat)`.
- `models/Combo.ts`: `bestCombo(cards: ICard[]) -> { type, scoringCards, chips, multiplier, points }` — detector completo de combinações (usado pela rota de Jogada). Não reimplemente isso.
- `models/Draw.ts`: `drawCards({ deck, discard, meldPile, quantity, source }) -> { drawnCards, newDeck, newDiscard, newMeldPile }` — função pura, usada por `libs/actionDraw.ts`; `drawSourceAvailability(...)` — quais origens podem ser escolhidas (servidor e cliente).
- `models/Turn.ts`: `gameEndReason(players)` (`EFinishReason` ou null), `nextSeatWithAction(currentSeat, players)`, `winningTeam(players)` (null em empate), `scoreByTeam(players)`, `teamsWithMelds(players)` — rode `gameEndReason` ao final de toda ação que efetivamente conclui o turno (para Jogada/Descarte isso já está em `resolveActionWithDraw`, `libs/actionDraw.ts`) e, se vier um motivo, chame `finishGame`. Sempre publique `publish(\`game:${gameId}\`)` ao final.
- `models/Swap.ts`: `IPendingSwap` — shape de `games.pending_swap`.
- `models/GameState.ts`: `IGameState` — formato de resposta de `GET /api/games/[gameId]`, inclui `deck_count`, `discard_count` (Descarte, só contagem), `meld_pile` (Bolo, cartas públicas), `finish_reason`/`finished_at`, `pending_swap`/`you.needs_to_choose_swap` e `last_action` (`IPublicLastAction`, já com redação de privacidade — ver "Feed de última ação" na seção 3).
- `services/`: `getGame.ts`, `playMeld.ts`, `playDiscard.ts`, `startSwap.ts`, `chooseSwap.ts`.
- `logics/`: `PlayMeld.tsx`, `PlayDiscard.tsx`, `PlaySwap.tsx` (duas fases da Troca: `StartSwap*`/`ChooseSwap*`/`PendingSwapBanner`). `PlayMeld`/`PlayDiscard` só abrem a escolha de origem; a mutação recebe `{ cards, source }`.
- `components/`: `Card.tsx` (`<Card card={ICard|null} size="sm|md|lg" selected? onClick? layoutId? />`, já é um componente `motion` — ver "Animações" na seção 3), `MeldPile.tsx` (Bolo — clique abre a lista, hover = ring dourado), `DiscardPile.tsx` (Descarte — pilha virada para baixo com contagem), `GameResult.tsx` (tela de resultado por equipe + motivo do fim), `GameEndAnimation.tsx` (animação de encerramento), `SoundToggle.tsx` (mudo), `ComboReference.tsx` (`ComboHelpButton`, consulta de combinações), `Scoreboard.tsx` (placar agregado por dupla), `MeldScoreAnimation.tsx` (motor único da animação de pontuação — cartas voando do assento até o centro, evidência das cartas pontuando, salto+soma+multiplicador; recebe `origin: {x,y}` de quem jogou), alimentado por `MeldScoreAnimationLayer.tsx` (todos os jogadores, via `last_action`), `DrawSourcePicker.tsx` (escolha Monte/Descarte antes de enviar Jogada/Descarte), `DrawAnimation.tsx`, `SwapAnimation.tsx`, `DiscardAnimation.tsx` (as demais camadas de animação, todas montadas em `app/games/[gameId]/page.tsx` dentro do container relativo dos 4 assentos). **Nota:** `resources/{módulo}/components/` é uma pasta nova, fora da lista original de `file-organization.md` (`enums/fragments/logics/mocks/models/schemas/services`) — foi criada porque este projeto (jogo) precisa de componentes visuais compartilhados de domínio que o template de CRUD original não previa. Reutilize esta pasta para outros componentes visuais do jogo em vez de criar `components/` genérico ou duplicar em cada fragment.
- `hooks/`: outra pasta nova, mesmo motivo. `useAnimatedLastAction.ts` — ver "Animações" na seção 3.

### Rotas já existentes

- `POST /api/rooms`, `GET /api/rooms/[code]`, `POST /api/rooms/[code]/join`, `POST /api/rooms/[code]/start`, `GET /api/rooms/[code]/stream` (SSE).
- `GET /api/games/[gameId]` — snapshot personalizado (usa `getCurrentGamePlayer`).
- `POST /api/games/[gameId]/meld`, `.../discard` — body `{ cards, source }`: jogam/descartam, compram da origem escolhida e resolvem o turno numa única requisição (`libs/actionDraw.ts`).
- `POST /api/games/[gameId]/swap/start`, `.../swap/choose`.
- `GET /api/games/[gameId]/stream` (SSE).

### Páginas

- `app/page.tsx` (home: criar/entrar sala), `app/rooms/[code]/page.tsx` (lobby de espera), `app/games/[gameId]/page.tsx` (mesa de jogo — resolve a posição relativa dos 4 assentos, mostra mão própria, contadores de Jogadas/Descartes de todos, Monte/Bolo/Descarte compartilhados, indicador de turno, aviso de fim antecipado, placar agregado, botões de som e ajuda, sons de troca de vez, e já tem os fluxos de Jogada/Descarte/Troca/Compra funcionais plugados; quando a Partida termina, troca o tabuleiro por `GameResult` — após a animação final se o fim aconteceu enquanto a página estava aberta). O estado de cartas selecionadas da mão (`selectedCards: string[]`, via `useState` na própria página) é compartilhado entre Jogada/Descarte/Troca — reaproveite-o em vez de criar um estado paralelo. Nenhum subagente de animação deve editar este arquivo diretamente (ver "Animações" na seção 3) — a integração final é feita numa passada só depois que todos terminarem.
