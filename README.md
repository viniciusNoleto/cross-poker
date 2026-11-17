# Cross Poker

Cross Poker is an online card game for four players (two teams of two), built with [Next.js](https://nextjs.org). It combines a traditional trick-based card game played in pairs with scoring mechanics inspired by [Balatro](https://store.steampowered.com/app/2379780/Balatro/) — plays are scored like poker hands, with chips and multipliers instead of a flat point count.

## Origin

This project started after a long Balatro session: I really wanted to play a simplified, "duplas" version of it with my friends, and no such game existed online, so I decided to build it myself!

It's also a personal learning project and a piece of my curriculum — a chance to get hands-on with [Next.js](https://nextjs.org), which I'm actively studying, while building something I actually wanted to play. Real-time state (whose turn it is, what's on the table, hidden vs. public cards) is synced across all four players via Server-Sent Events, with no login required — you just join a room with a nickname and a room code.

## How it works

- 4 players, 2 teams, seated in opposite positions; turn order goes clockwise, naturally alternating teams.
- On your turn you either make a **play** (*jogada*: score a poker-style hand from your cards), use a **discard** (*descarte*), or **swap** cards secretly with your partner.
- Plays are scored like Balatro hands (pair, flush, full house, straight flush, etc.) — chips from the scoring cards, multiplied by the hand's multiplier.
- The match ends when no player has any plays left — or earlier, when only one team still has plays and it is already ahead. The team with the higher combined score wins.

An implementation-oriented version of these rules (EN/PT vocabulary mapping, architecture decisions) lives in [`.claude/rules/game-concept.md`](./.claude/rules/game-concept.md).

### Components

- 1 standard deck (52 cards).
- Scoring tokens/counters.

### Piles

- **Deck (Monte)** — the pile of remaining cards after the initial deal. You can draw from it.
- **Played pile (Bolo)** — every card used in a play, kept face-up and visible to everyone. You can **not** draw from it; it only returns to the game when the Deck runs out (it is shuffled into a new Deck).
- **Discard pile (Descarte)** — cards discarded with a discard action, kept face-down. You can draw from its top.

### Setup

Each player starts with:

- 8 cards in hand;
- 5 plays;
- 5 discards.

The rest of the deck becomes the draw pile.

### Turn flow

On their turn, a player performs **exactly one** of the following actions: make a play, or use a discard (a team swap can replace a discard action — see below). A player with no actions left (0 plays **and** 0 discards) is skipped in turn order.

### Play (Jogada)

A play is the scoring action.

- Consumes 1 play token.
- The player plays **1 to 5 cards** from their hand.
- The game automatically finds the best valid combo among the played cards.
- Only the cards that form that combo score; the rest are still played but don't score.
- All played cards go to the played pile (Bolo) face-up.
- After playing, the player draws back up to 8 cards in hand.

### Discard (Descarte)

A discard is a hand-management action.

- Consumes 1 discard token.
- The player discards **1 to 5 cards**, which go to the discard pile (Descarte) face-down.
- The player then draws the same number of cards back.

### Drawing cards

Whenever a player needs to draw, the draw must come from a single source — the Deck **or** the discard pile (Descarte), never mixed within the same draw. The played pile (Bolo) is never a draw source.

### Team swap

During their turn, a player may replace a discard action with a team swap.

- The player declares how many cards they want to swap (**1 to 5**).
- Both partners need at least 1 discard token available.
- Each partner secretly picks that many cards from their hand.
- The cards are swapped simultaneously; the contents stay secret from the other team.
- Each participant consumes 1 discard token.
- No one draws cards after a swap.

### Combos

Variable-size combos (1 to 5 cards): High Card, Pair, Two Pair, Three of a Kind, Four of a Kind.

Combos that require exactly 5 cards: Straight, Flush, Full House, Straight Flush.

### Scoring

Scoring follows the Balatro system. For each play:

1. Sum the chips of the cards that form the valid combo.
2. Multiply by the combo's multiplier.

Cards played outside the combo don't score.

| Hand | Base Chips | Multiplier |
| --- | ---: | ---: |
| High Card | 5 | ×1 |
| Pair | 10 | ×2 |
| Two Pair | 20 | ×2 |
| Three of a Kind | 30 | ×3 |
| Straight | 30 | ×4 |
| Flush | 35 | ×4 |
| Full House | 40 | ×4 |
| Four of a Kind | 60 | ×7 |
| Straight Flush | 100 | ×8 |

| Card | Chips |
| --- | ---: |
| Ace | 11 |
| King / Queen / Jack / 10 | 10 |
| 9..2 | face value |

### End of match

The match ends when no player has any plays left. It also ends early as soon as only one team still has plays **and** that team is already ahead — the other team can no longer score, so the result can't change (the game screen warns about this while it can happen). A match with no action for more than 1 hour is closed automatically, with the score of that moment. A team's score is the sum of both partners' scores; the team with the higher score wins (equal totals are a tie).

## Tech Stack

- [Next.js](https://nextjs.org)
- [React](https://react.dev)
- [Mantine](https://mantine.dev) (UI components)
- [TanStack Query](https://tanstack.com/query) (data fetching/caching)
- [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- [Yup](https://github.com/jquense/yup) (schema validation)
- [Tailwind CSS](https://tailwindcss.com)
- [i18next](https://www.i18next.com) (internationalization)
- [motion](https://motion.dev) (card animations)
- Server-Sent Events for real-time sync (no WebSocket infra needed)
- Web Audio API for the retro sound effects (synthesized at runtime, no audio files)

## Configuration & Deploy

### Requirements

- Docker + Docker Compose

### Local setup

```bash
cp .env.example .env   # fill POSTGRES_PASSWORD
make install           # build, npm install, up, migrations → http://localhost:3000
```

### Deploy (homolog / production)

`docker-compose.homolog.yml` and `docker-compose.production.yml` run the app (`configs/docker/node/Dockerfile.deploy`, multi-stage `next build` → `next start`) and its Postgres, behind the server's **Nginx Proxy Manager**, which handles the domain and the Let's Encrypt certificate. Neither container publishes a port: the app joins NPM's Docker network, and Postgres stays on the private `cross-poker-network`. Pending Drizzle migrations run automatically every time the app container starts.

1. `cp .env.example .env` and set `APP_ENV=homolog` or `production`, plus `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`.
2. Set `PROXY_NETWORK` to NPM's network name (`docker network ls`; default `nginx-proxy-manager`).
3. `make build && make up` (later updates: `git pull && make update-build`, which keeps Postgres running).
4. In NPM, add a Proxy Host: your domain → scheme `http`, forward hostname `cross-poker-front`, port `3000`; in the SSL tab request a Let's Encrypt certificate and enable *Force SSL*.

Notes:

- Real-time sync uses SSE with an **in-memory** pub/sub, so run a **single** app container (no replicas).
- Responses carry `X-Accel-Buffering: no`, so NPM's nginx does not buffer the SSE streams — no custom NPM config is needed.
- The session cookie gets `Secure` when the request arrived over HTTPS (read from the proxy's `X-Forwarded-Proto`), so serve the app over HTTPS.

## About the author

Cross Poker is part of my personal portfolio, showcasing my work as I learn Next.js.

Created by [Vinícius Nolêto de Araújo](https://www.linkedin.com/in/vin%C3%ADcius-nol%C3%AAto-de-ara%C3%BAjo/) — connect with me on LinkedIn.

## License

See [LICENSE.md](./LICENSE.md) for the full terms.
