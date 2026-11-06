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
| **Monte** | `Deck` | Pilha de compra, com as cartas remanescentes após a distribuição inicial. |
| **Bolo** | `Discard` | Pilha de descarte da Partida (compartilhada). Contém cartas descartadas (viradas para baixo) e cartas jogadas em Mesas (viradas para cima). Também é o nome do **token/ação** "usar 1 Bolo" (cada jogador começa com 5). |
| **Mesa** | `Meld` | Jogada de pontuação: usar 1 a 5 cartas da mão para formar a melhor combinação válida. Também é o nome do **token/ação** "usar 1 Mesa" (cada jogador começa com 5). Não usamos `Play`/`Table` no código: `Play` colide com o verbo genérico já usado nos nomes de serviço (`play{Ação}Service`, ex. `playMeldService`/`playDiscardService`), e `Table` colidiria com `UtilsTable`/"tabela do banco". |
| **Troca** | `Swap` | Ação alternativa ao Bolo: troca secreta de cartas entre parceiros de equipe. Consome 1 Bolo de cada parceiro. |
| **Compra** | `Draw` | Ato de comprar cartas do Monte ou do Bolo — sempre parte de uma Mesa ou de um Bolo, nunca uma ação de turno independente. |
| **Combinação** | `Combo` | Classificação da jogada de Mesa (Par, Flush, Full House etc). |
| **Equipe** | `Team` | Dupla de 2 jogadores sentados em posições opostas. |
| **Carta** | `Card` | Naipe (`Suit`) + Valor (`Rank`) + Chips. O jogo usa 1 baralho (52 cartas, cada carta física é uma instância única). |
| **Naipe** | `Suit` | copas/ouros/paus/espadas → hearts/diamonds/clubs/spades (também os valores do enum e o formato do id de carta, ex. `"hearts-A-1"`). |
| **Valor** | `Rank` | A..K (os valores string do enum permanecem 'A','2'..'10','J','Q','K'). |
| **Chips** | `Chips` | Valor numérico de pontuação base de uma carta ou de uma Mesa. |
| **Multiplicador** | `Multiplier` | Fator aplicado aos Chips somados de uma Mesa, conforme a combinação formada. |

---

## 2. Regras do jogo (resumo operacional)

Ver `README.md` para o texto integral das regras originais. Pontos que a implementação precisa respeitar à risca:

- 4 jogadores, 2 duplas, sentados em posições opostas (assentos 0-3; equipe A = assentos {0,2}, equipe B = assentos {1,3}).
- Ordem de turno: sentido horário (0→1→2→3→0...), o que já alterna equipes automaticamente a cada turno.
- Início: cada jogador recebe 8 cartas na mão, 5 Mesas, 5 Bolos. O resto forma o Monte (embaralhado).
- No turno, o jogador faz **exatamente uma** ação: Mesa, Bolo, ou Troca (Troca substitui um Bolo, não é uma terceira opção independente).
- Jogador sem nenhuma ação disponível (0 Mesas **e** 0 Bolos) é pulado na ordem de turnos.
- **Mesa**: consome 1 Mesa; joga 1 a 5 cartas da mão; o jogo identifica automaticamente a melhor combinação válida entre as cartas jogadas; só as cartas da combinação pontuam; todas as cartas jogadas (pontuando ou não) vão para o Bolo viradas para cima — **mas só depois que a origem da compra for escolhida** (ver abaixo), nunca no momento da jogada; depois o jogador compra até voltar a 8 cartas na mão, de uma única origem (Monte OU Bolo, nunca misturado na mesma compra). **A escolha da origem acontece DEPOIS da jogada (fluxo em duas fases) — ver "Compra após a ação" na seção 3.**
- **Bolo**: consome 1 Bolo; descarta 1 a 5 cartas da mão (vão para o Bolo viradas para baixo, **só depois que a origem da compra for escolhida** — ver abaixo); compra a mesma quantidade, de uma única origem (Monte OU Bolo). **Mesma observação: a escolha da origem acontece DEPOIS do descarte — ver "Compra após a ação" na seção 3.**
- **Troca**: o jogador declara quantas cartas quer trocar (1-5); ambos os parceiros precisam ter ≥1 Bolo; cada um escolhe secretamente essa quantidade de cartas; a troca é simultânea; ninguém mais vê o conteúdo; cada participante consome 1 Bolo; **não há compra** após a troca.
- Fim da Partida: quando **nenhum jogador** possui Mesas restantes (checar após cada ação — pode acontecer com jogadores ainda tendo Bolos sobrando, o jogo acaba mesmo assim). Pontuação da dupla = soma da pontuação dos dois integrantes. Maior pontuação vence.

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

1. **Esgotamento do Monte**: se uma compra precisar de mais cartas do que o Monte tem, embaralhe **todas** as cartas do Bolo (as viradas para cima e as viradas para baixo) formando um novo Monte, e continue a compra. O Bolo fica vazio depois disso.
2. **Compra a partir do Bolo**: o Bolo é tratado como uma pilha (LIFO) — comprar do Bolo compra as N cartas do topo da pilha, na ordem em que foram colocadas, independentemente de estarem viradas para cima ou para baixo (a identidade de cartas viradas para cima já era pública; a de cartas viradas para baixo só é revelada ao jogador que compra).
3. **Primeiro jogador da Partida**: sorteado aleatoriamente entre os 4 assentos quando a Partida começa (não especificado no texto original de regras do `README.md`).
4. **Dono da Sala (host)**: o jogador que cria a Sala. Só ele pode iniciar a Partida, e apenas quando houver exatamente 4 jogadores presentes.
5. **Compra insuficiente mesmo após esgotamento**: se, mesmo depois de aplicar as regras acima (reembaralhar o Bolo no Monte quando a origem é Monte; ou simplesmente o Bolo não ter cartas suficientes quando a origem é Bolo), ainda não houver cartas suficientes para completar a `quantidade` pedida, a compra entrega **o quanto houver disponível** (podendo ser até 0 cartas) e para silenciosamente — sem lançar erro. A camada de API decide o que fazer com uma mão que ficou abaixo de 8 cartas (normalmente nada: aguarda a próxima compra dar mais cartas ao jogador).

---

## 3. Decisões técnicas

### Stack (herdado do projeto base, mantido)
Next.js (App Router, Route Handlers) + Drizzle ORM + PostgreSQL + TanStack Query + Mantine (componentes de base, tema visual será totalmente customizado) + Tailwind + Yup + i18next (pt-br, es-mx, en-us).

### Identidade do jogador — sem login
Não há sistema de contas. Um jogador entra numa Sala informando um **apelido** + o **código da Sala**. Ao entrar, o servidor cria um registro `room_players` com um `session_token` (uuid) opaco e devolve um cookie **httpOnly**, `sameSite=lax`, nome `cp_session_{room_code}`, valor = `session_token`. Toda rota que precisa saber "quem é o jogador fazendo a requisição" lê esse cookie e busca o `room_players` correspondente — nunca confie em um `player_id` vindo do body/query. Isso também é o que impede um jogador de ver a mão de outro: o servidor só devolve a mão do jogador dono da sessão.

### Tempo real — Server-Sent Events
Cada cliente conectado a uma Sala/Partida abre um stream SSE em `app/api/rooms/[code]/stream/route.ts` (lobby) ou `app/api/games/[gameId]/stream/route.ts` (partida). O servidor mantém um **pub/sub em memória** (um `EventEmitter`/registro de `ReadableStreamDefaultController` por sala/partida, singleton do processo Node) — quando uma ação muda o estado, publica um evento `state-changed` para todos os streams daquela sala/partida; cada stream, ao receber o evento, busca e envia (via SSE) o snapshot **personalizado** daquele jogador (nunca inclui mãos alheias). Não há Redis/infra nova — suficiente para o volume de um jogo entre amigos rodando num único processo. Se um dia precisar escalar horizontalmente, o pub/sub em memória precisaria virar Redis pub/sub — não implementar isso agora, apenas manter a interface do publisher isolada (`libs/realtime.ts`) para facilitar essa troca futura.

### Feed de "última ação" (para as animações)

`IGameState.last_action` (`IPublicLastAction`, em `resources/game/models/GameState.ts`) expõe a última linha de `game_actions` da Partida, já filtrada por privacidade, calculada em `GET /api/games/[gameId]` (`app/api/games/[gameId]/route.ts`) — **não reimplemente essa busca em nenhuma rota nova**, ela já roda em toda chamada ao snapshot.

- Todo snapshot traz o MESMO `last_action` até que uma nova ação aconteça — o cliente usa o campo `id` (id da linha em `game_actions`) para saber se já reagiu a ela (guarde o último `id` visto, ex. num `useRef`, e só dispare a animação quando `id` mudar).
- **Redação de privacidade** (importante — não vaze a mão de ninguém através disso): cartas que ainda são privadas (as compradas, sempre; as descartadas no Bolo, porque ficam viradas para baixo) só vêm preenchidas quando `seat` da ação é o SEU PRÓPRIO assento. Para os outros jogadores vendo a ação de alguém, só a CONTAGEM aparece (`drawn_count`/`discarded_count`), nunca a identidade — a animação de "outros jogadores vendo alguém comprar/descartar" deve desenhar cartas viradas para baixo (`<Card card={null} />`), não os valores reais. Já as cartas de uma jogada de Mesa (`melded_cards`/`scoring_cards`) são sempre públicas (vão para o Bolo viradas para cima, todo mundo já vê o valor ali mesmo) — a animação de Mesa pode mostrar os valores reais para todos.
- `type` diz qual animação disparar (`'meld' | 'discard' | 'swap'` — Compra nunca aparece como `type` isolado, ela sempre é parte do payload de uma Mesa/Bolo via `draw_source`/`drawn_count`, já que agora acontece na mesma ação, só numa segunda requisição — ver "Compra após a ação" acima).

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
    ├── models/              # Card, Deck, Combo, Draw, Team, Turn, GameState, PendingDraw, Swap
    ├── services/            # getGameService, playMeldService, playDiscardService, startSwapService, chooseSwapService, chooseDrawSourceService
    ├── logics/              # PlayMeld, PlayDiscard, PlaySwap, ChooseDrawSource
    ├── components/          # Card, DiscardPile, Scoreboard, ComboReference, animações
    └── hooks/               # useAnimatedLastAction
```

### Modelo de dados (Drizzle — `db/schema/`)

- `rooms`: id (serial), code (varchar único, curto, ex. 6 chars), status (`waiting|playing|finished`), created_at.
- `room_players`: id, room_id (fk), name, seat (0-3, único por sala), session_token (uuid, único), is_host (bool), connected_at, created_at.
- `games`: id, room_id (fk), status (`playing|finished`), current_seat (0-3), deck (jsonb — array de ids de carta, ordem = fundo→topo; **o topo, próxima carta a comprar, é o ÚLTIMO elemento do array** — use `.pop()`, nunca `.shift()`), discard (jsonb — array de `{card_id, face_up}`, mesma convenção: ordem = base→topo, o topo é o último elemento — use `.pop()`/`.push()`), winning_team (`A|B`|null), created_at, finished_at.
- `game_players`: id, game_id (fk), seat (0-3), hand (jsonb array de ids de carta — **nunca exposto a outros jogadores via API**), melds_remaining (int, default 5), discards_remaining (int, default 5), score (int, default 0).
- `game_actions`: id, game_id (fk), seat, type (`meld|discard|swap|draw`), payload (jsonb — detalhes da jogada, usado tanto para histórico quanto para as animações saberem o que aconteceu), created_at.

Carta é representada como um objeto `{ id, suit, rank }` (chips derivado de `rank` via tabela fixa, nunca persistido redundantemente). `id` de carta é único por instância física (ex.: `"hearts-A-1"` para o Ás de Copas do baralho único).

### Compra após a ação (fluxo em duas fases)

Decisão de UX (não é uma regra do texto original de regras do `README.md`, é sobre *quando*, na interface, a origem é escolhida — o resultado final da jogada é o mesmo): jogar uma Mesa ou usar um Bolo acontece em **duas requisições**, não uma só, espelhando o padrão já usado pela Troca (`pending_swap`):

1. **Jogar/descartar** (`POST .../meld` ou `POST .../discard`): aplica só o que já é decidido pela própria jogada — remove as cartas da mão, decrementa `melds_remaining`/`discards_remaining`, soma a pontuação (Mesa). **As cartas jogadas/descartadas AINDA NÃO vão para `games.discard` nesta etapa** — ficam guardadas apenas em `pending_draw.details` (`melded_cards`/`discarded_cards`). **Não compra cartas ainda** e **não avança o turno**. Em vez disso, grava `games.pending_draw = { seat, quantity, action_type, details }` (coluna jsonb nullable, mesmo padrão de `pending_swap`) e retorna imediatamente o resultado da jogada (ex.: `points_scored`/`combo` da Mesa) para a UI já poder mostrar a pontuação.
2. **Escolher origem** (`POST /api/games/[gameId]/draw`, endpoint compartilhado entre Mesa e Bolo, body `{ source: 'deck'|'discard' }`): só o jogador de `pending_draw.seat` pode chamar. Valida se a origem escolhida tem cartas suficientes (Monte é válido a menos que `deck_count + discard.length < quantity`; Bolo só é válido se `discard.length >= quantity` — sem essa checagem o jogador poderia "escolher" uma origem vazia e ficar com a mão incompleta sem necessidade; note que `discard.length` aqui ainda NÃO inclui as cartas desta jogada, então o jogador nunca pode comprar de volta as cartas que acabou de jogar/descartar). Só então chama `drawCards` (usando o Bolo **sem** as cartas desta jogada) e, com o resultado já calculado, empilha `pending_draw.details.melded_cards`/`discarded_cards` no topo do Bolo resultante — só aí elas se tornam parte pública/comprável do Bolo. Atualiza a mão, limpa `pending_draw`, roda o checklist de fim-de-turno de `Turn.ts` (que por isso só acontece nesta segunda etapa) e grava a linha final em `game_actions`.

Enquanto `pending_draw !== null`, nenhuma outra ação (Mesa/Bolo/Troca-iniciar) pode ocorrer — mesma lógica de bloqueio já usada para `pending_swap` (ver `IGameState.pending_draw`/`you.needs_to_choose_draw`, já expostos por `GET /api/games/[gameId]`).

### Animações — biblioteca `motion` e o hook `useAnimatedLastAction`

Instalada a lib `motion` (sucessora do Framer Motion, `import { motion, AnimatePresence } from 'motion/react'`) — é a única dependência de animação do projeto, não instale outra.

- `resources/game/components/Card.tsx` já é um componente `motion` (`motion.div`/`motion.button` com `layout` ativo) e aceita uma prop opcional `layoutId`. Duas `<Card>` com o mesmo `layoutId`, mesmo em partes diferentes da árvore/tela, animam a transição de posição/tamanho entre elas automaticamente — é o mecanismo certo para "carta voando" de uma pilha pra outra (ex.: do Monte pra mão, da mão pro Bolo) sem calcular posição manualmente. Para a carta desmontar de um lugar e montar em outro dentro da mesma transição, envolva a região com `<AnimatePresence>`.
- `resources/game/hooks/useAnimatedLastAction.ts` (pasta nova, mesmo motivo de `components/` — ver nota abaixo): `const { newAction, clear } = useAnimatedLastAction(state.last_action)`. Dispara (`newAction` deixa de ser `null`) só quando chega uma ação com `id` diferente do último já visto — evita cada camada de animação reimplementar esse controle. `newAction` fica preenchida até você mesmo chamar `clear()` quando sua animação terminar de tocar.
- **Várias animações reagem à MESMA `last_action`, sem conflito** — elas são camadas visuais independentes: uma jogada de Mesa gera uma única linha em `last_action` com `type: 'meld'`, mas ela carrega tanto os dados da pontuação (`combo`/`chips`/`multiplier`/`points`, para a animação de contagem de pontos) quanto os dados da compra que a conclui (`draw_source`/`drawn_count`/`drawn_cards`, para a animação de compra) — cada camada olha só os campos que lhe interessam e ignora o resto. Idem para `type: 'discard'` (descarte + compra) e `type: 'swap'`.
- **Para o jogador que fez a jogada**, o resultado imediato (pontuação da Mesa) já chega antes de `last_action` existir — via retorno direto de `POST .../meld` (`points_scored`/`combo`/`chips`/`multiplier`, ver `resources/game/services/playMeld.ts`) — `last_action` só aparece depois que a compra é resolvida (ver "Compra após a ação" acima). Sua animação para o autor pode usar esse retorno direto (mais rápido, não espera a compra); para os OUTROS jogadores vendo a ação, use `last_action`.
- Cada subagente de animação constrói sua própria camada (componente que recebe `state: IGameState` e renderiza sua própria sobreposição/efeito) mas **não edita `app/games/[gameId]/page.tsx`** — a integração de todas as camadas de animação é feita numa passada só, depois que todos terminarem, para evitar concorrência de edição no mesmo arquivo.

### Formato de API
Segue `api-response-format.md` (envelope `{ success, message, data }`, chaves snake_case) e `resources-services.md` para os arquivos de `services/`.

---

## 4. Roadmap deste projeto (para dar contexto do que já existe / o que falta)

1. ✅ Sala (lobby): criar/entrar/iniciar Partida com 4 jogadores.
2. ✅ Ambiente de Partida: mão privada, contadores públicos de Mesas/Bolos, turno, stream SSE.
3. ✅ Ação de Mesa (jogar combinação + pontuar) — `resources/game/models/Combo.ts` + `app/api/games/[gameId]/meld`.
4. ✅ Ação de Bolo (descartar + comprar) — `app/api/games/[gameId]/discard`.
5. ✅ Ação de Troca (troca secreta entre parceiros, fluxo em duas fases com transação) — `app/api/games/[gameId]/swap/{start,choose}`.
6. ✅ Compra de cartas (Monte/Bolo) como estrutura compartilhada — `resources/game/models/Draw.ts`.
7. ✅ **Compra após a ação** (fluxo em duas fases para Mesa/Bolo — ver seção 3, "Compra após a ação") — `POST /api/games/[gameId]/draw`, `resources/game/logics/ChooseDrawSource.tsx`.
8. ✅ **Exibição de pontuação**: `resources/game/components/MeldScoreAnimationSelf.tsx` (feedback da jogada, só para o autor — hoje reaproveita o mesmo motor da animação, ver item 12) + `resources/game/components/Scoreboard.tsx` (placar agregado por dupla, sempre visível).
9. ✅ **Hover no Bolo**: `resources/game/components/DiscardPile.tsx`.
10. ✅ **Botão de consulta de mãos**: `resources/game/components/ComboReference.tsx` (`ComboHelpButton`).
11. ✅ **Feed de "última ação"**: `IGameState.last_action` — ver seção 3, "Feed de última ação".
12. ✅ **Animação: pontuação da Mesa** — ÚNICA e IDÊNTICA para todos (ver "Animações" na seção 3): as cartas jogadas voam do assento de quem jogou até o centro do tabuleiro, só as cartas da combinação ficam em evidência (maiores, elevadas, com brilho — as demais pousam menores e apagadas), depois cada carta pontuando salta revelando seu valor de Chips (com um "+N" flutuante), soma a um contador, e por fim mostra o multiplicador e o total. Motor único: `resources/game/components/MeldScoreAnimation.tsx`. Dois wrappers alimentam o mesmo motor com fontes de dados diferentes (só isso muda, nunca o visual): `MeldScoreAnimationSelf.tsx` (você, via retorno direto de `POST .../meld`, mais rápido — não espera a compra) e `MeldScoreAnimationObservers.tsx` (demais jogadores, via `last_action`).
13. ✅ **Animação: compra do Monte/Bolo** (cartas indo pra mão de quem comprou, todos os pontos de vista) — `resources/game/components/DrawAnimation.tsx`.
14. ✅ **Animação: Troca de Equipe** (todos os pontos de vista) — `resources/game/components/SwapAnimation.tsx`.
15. ✅ **Animação: descarte de Bolo** — `resources/game/components/DiscardAnimation.tsx`.

Itens 12-15 foram implementados por subagentes que leram este arquivo (em especial "Animações — biblioteca `motion`...", seção 3) e depois integrados numa passada única em `app/games/[gameId]/page.tsx`.

---

## 5. O que já existe (não reimplemente — reutilize)

### Infra / libs (`libs/`)

- `libs/session.ts` — `setRoomSessionCookie(roomCode, token)` / `getRoomSessionToken(roomCode)`. Cookie httpOnly por Sala.
- `libs/roomAuth.ts` — `getCurrentRoomPlayer(roomCode, roomId)`: resolve o `room_players` (colunas públicas) do cookie da requisição atual, ou `null`.
- `libs/gameAuth.ts` — `getCurrentGamePlayer(gameId)`: resolve `{ game, room, roomPlayer, gamePlayer }` a partir do cookie da Sala dona da Partida. **Use isto em toda rota de ação** (Meld/Discard/Swap/Draw) para descobrir quem está fazendo a requisição e comparar `game.current_seat === roomPlayer.seat` antes de aceitar qualquer jogada.
- `libs/realtime.ts` — `publish(channel)` / `subscribe(channel, listener)`, pub/sub em memória. Canais em uso: `` `room:${roomCode}` `` e `` `game:${gameId}` ``. **Toda rota que muda o estado de uma Partida deve chamar `publish(\`game:${gameId}\`)` no final**, senão os outros 3 jogadores só vêem a mudança no próximo refetch manual.

### Banco (`db/schema/`)

Tabelas `rooms`, `room_players` (+ `roomPlayerPublicColumns`, nunca selecione `session_token` para o cliente), `games`, `game_players`, `game_actions` — ver seção 3 para as colunas. `game_actions` é escrita por cada ação (Meld/Discard/Swap/Draw) ao concluir, para dar suporte ao histórico e às animações (`payload` traz o suficiente para a animação saber o que desenhar, ex.: cartas jogadas, combinação formada, origem da compra).

### Módulo `resources/game/`

- `enums/`: `ESuit` (hearts/diamonds/clubs/spades), `ERank` (A..K), `EGameStatus`, `ETeam` (A/B), `EDrawSource` (deck/discard), `EActionType` (meld/discard/swap/draw), `ECombo` (high_card..straight_flush).
- `models/Card.ts`: `ICard`, `CHIPS_BY_RANK`, `chipsForCard(card)`, `cardById(id)` (reconstrói `ICard` a partir do id, ex. `"hearts-A-1"`), `RANK_ORDER` (ordem alta, sem considerar Ás baixo — ver seção 2, decisão 1 sobre sequência).
- `models/Deck.ts`: `buildDeck(deckCount = 1)`, `shuffle(items)` (Fisher-Yates genérico).
- `models/Team.ts`: `teamForSeat(seat)`.
- `models/Combo.ts`: `bestCombo(cards: ICard[]) -> { type, scoringCards, chips, multiplier, points }` — detector completo de combinações (usado pela rota de Mesa). Não reimplemente isso.
- `models/Draw.ts`: `drawCards({ deck, discard, quantity, source }) -> { drawnCards, newDeck, newDiscard }` — função pura, usada por Mesa/Bolo (e pela rota `.../draw`).
- `models/Turn.ts`: `gameShouldEnd(players)`, `nextSeatWithAction(currentSeat, players)`, `winningTeam(players)` — rode este checklist ao final de toda ação que efetivamente conclui o turno (ver "Compra após a ação": para Mesa/Bolo isso agora acontece na etapa de compra, não na jogada em si). Sempre publique `publish(\`game:${gameId}\`)` ao final.
- `models/Swap.ts`: `IPendingSwap` — shape de `games.pending_swap`.
- `models/PendingDraw.ts`: `IPendingDraw` — shape de `games.pending_draw`.
- `models/GameState.ts`: `IGameState` — formato de resposta de `GET /api/games/[gameId]`, inclui `pending_swap`/`you.needs_to_choose_swap`, `pending_draw`/`you.needs_to_choose_draw`, e `last_action` (`IPublicLastAction`, já com redação de privacidade — ver "Feed de última ação" na seção 3).
- `services/`: `getGame.ts`, `playMeld.ts`, `playDiscard.ts`, `startSwap.ts`, `chooseSwap.ts`, `chooseDrawSource.ts`.
- `logics/`: `PlayMeld.tsx`, `PlayDiscard.tsx`, `PlaySwap.tsx` (duas fases da Troca: `StartSwap*`/`ChooseSwap*`/`PendingSwapBanner`), `ChooseDrawSource.tsx` (escolha de origem pós-jogada).
- `components/`: `Card.tsx` (`<Card card={ICard|null} size="sm|md|lg" selected? onClick? layoutId? />`, já é um componente `motion` — ver "Animações" na seção 3), `DiscardPile.tsx` (pilha do Bolo com hover revelando tudo), `ComboReference.tsx` (`ComboHelpButton`, consulta de combinações), `Scoreboard.tsx` (placar agregado por dupla), `MeldScoreAnimation.tsx` (motor único da animação de pontuação — cartas voando do assento até o centro, evidência das cartas pontuando, salto+soma+multiplicador; recebe `origin: {x,y}` de quem jogou), reaproveitado por `MeldScoreAnimationSelf.tsx` (visão do autor, via retorno direto de `POST .../meld`) e `MeldScoreAnimationObservers.tsx` (visão dos demais, via `last_action`), `DrawAnimation.tsx`, `SwapAnimation.tsx`, `DiscardAnimation.tsx` (as demais camadas de animação, todas montadas em `app/games/[gameId]/page.tsx` dentro do container relativo dos 4 assentos). **Nota:** `resources/{módulo}/components/` é uma pasta nova, fora da lista original de `file-organization.md` (`enums/fragments/logics/mocks/models/schemas/services`) — foi criada porque este projeto (jogo) precisa de componentes visuais compartilhados de domínio que o template de CRUD original não previa. Reutilize esta pasta para outros componentes visuais do jogo em vez de criar `components/` genérico ou duplicar em cada fragment.
- `hooks/`: outra pasta nova, mesmo motivo. `useAnimatedLastAction.ts` — ver "Animações" na seção 3.

### Rotas já existentes

- `POST /api/rooms`, `GET /api/rooms/[code]`, `POST /api/rooms/[code]/join`, `POST /api/rooms/[code]/start`, `GET /api/rooms/[code]/stream` (SSE).
- `GET /api/games/[gameId]` — snapshot personalizado (usa `getCurrentGamePlayer`).
- `POST /api/games/[gameId]/meld`, `.../discard` — jogam/descartam e deixam `pending_draw` marcado; não compram mais na mesma requisição.
- `POST /api/games/[gameId]/draw` — segunda fase de Mesa/Bolo, escolhe a origem e resolve o turno.
- `POST /api/games/[gameId]/swap/start`, `.../swap/choose`.
- `GET /api/games/[gameId]/stream` (SSE).

### Páginas

- `app/page.tsx` (home: criar/entrar sala), `app/rooms/[code]/page.tsx` (lobby de espera), `app/games/[gameId]/page.tsx` (mesa de jogo — resolve a posição relativa dos 4 assentos, mostra mão própria, contadores de Mesas/Bolos de todos, Monte/Bolo compartilhados, indicador de turno, placar agregado, botão de ajuda, e já tem os fluxos de Mesa/Bolo/Troca/Compra funcionais plugados). O estado de cartas selecionadas da mão (`selectedCards: string[]`, via `useState` na própria página) é compartilhado entre Mesa/Bolo/Troca — reaproveite-o em vez de criar um estado paralelo. Nenhum subagente de animação deve editar este arquivo diretamente (ver "Animações" na seção 3) — a integração final é feita numa passada só depois que todos terminarem.
