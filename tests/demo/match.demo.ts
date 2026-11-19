import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type APIRequestContext, expect, type Page, request as playwrightRequest, test } from '@playwright/test';
import { bestCombo } from '@/resources/game/models/Combo';
import { chipsForCard, type ICard } from '@/resources/game/models/Card';
import type { IGameState } from '@/resources/game/models/GameState';

/**
 * Vídeo de demonstração: a tela do anfitrião, do começo ao fim de uma partida.
 *
 * Roteiro: home → cria a sala → os amigos entram (pela API) → inicia a partida → algumas rodadas com
 * Jogada, Descarte e Troca (as animações de cada uma) → transição com a logo → fim da partida (animação
 * de encerramento e tela de resultado). A partida inteira levaria 20 Jogadas: durante a transição, o
 * banco é ajustado para que a próxima Jogada encerre a partida, e esse trecho sai do vídeo.
 *
 * Imagem: quadros do screencast do Chrome (CDP), cada um com o instante em que foi pintado.
 * Som: um script de inicialização (`installAudioTap`) desvia para um `MediaRecorder` tudo o que os
 * `AudioContext` dos efeitos sonoros mandam para os alto-falantes. A música da partida fica de fora dessa
 * gravação (ela só toca a partir da tela da partida): no fim, o ffmpeg corta os trechos, junta e mixa os
 * efeitos com a música (`public/audio/game-music.ogg`) tocando desde o primeiro quadro — abaixando a música
 * por instantes sob os efeitos, como o jogo faz —, gerando `videos/demo.mp4`.
 *
 * Tudo é medido no relógio monotônico (`performance.now()` do Node e da página), nunca no relógio de parede:
 * no WSL ele escorrega e dá saltos, e o vídeo do `recordVideo` do Playwright (que usa esse relógio) saía
 * dessincronizado do áudio.
 *
 *   npm run demo:video
 */

const ROOT = path.resolve(__dirname, '../..');
const VIDEO_DIR = path.join(ROOT, 'videos');
const RAW_DIR = path.join(ROOT, 'test-results-demo', 'raw-video');
const FRAMES_DIR = path.join(RAW_DIR, 'frames');
const MUSIC = path.join(ROOT, 'public', 'audio', 'game-music.ogg');
const SIZE = { width: 1440, height: 900 };
const PG_CONTAINER = process.env['DEMO_PG_CONTAINER'] ?? 'cross-poker-postgres';
const PG_USER = process.env['POSTGRES_USER'] ?? 'postgres';
const PG_DB = `${process.env['POSTGRES_DB'] ?? 'cross_poker'}_demo`;

/** Anfitrião (assento 0, quem grava) e os amigos, na ordem em que entram (assentos 1, 2 e 3). */
const HOST = 'Vinícius';
const FRIENDS = ['Alex', 'Matheus', 'João'];

/** Como a carta se apresenta na tela (`aria-label` do `Card`). */
const SUIT_NAME: Record<string, string> = { hearts: 'copas', diamonds: 'ouros', clubs: 'paus', spades: 'espadas' };

type Seat = { seat: number; name: string; api: APIRequestContext };

/** Uma gravação de áudio feita na página: `startedAt` é o `performance.now()` da página no início dela. */
type AudioTrack = { startedAt: number; recorded: number; data: string };

/** Um quadro do screencast: `at` é o instante (ms, `performance.now()` do Node) em que foi pintado. */
type Frame = { file: string; at: number };

/**
 * Grava a tela da página pelo screencast do Chrome. O quadro traz o instante da pintura no relógio de parede
 * do navegador; ele é convertido para o monotônico do Node pela diferença entre os dois na chegada (se a
 * conversão destoar da chegada — um salto do relógio no meio —, vale a própria chegada).
 */
async function startScreencast(page: Page) {
  mkdirSync(FRAMES_DIR, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames: Frame[] = [];

  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const arrival = performance.now();
    const painted = metadata.timestamp ? metadata.timestamp * 1000 - (Date.now() - arrival) : arrival;
    const file = path.join(FRAMES_DIR, `${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, at: Math.abs(arrival - painted) < 300 ? painted : arrival });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: SIZE.width, maxHeight: SIZE.height });

  return {
    stop: async () => {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();
      return frames.sort((a, b) => a.at - b.at);
    },
  };
}

/** Diferença (ms) entre o `performance.now()` do Node e o da página (os dois são o relógio monotônico). */
async function pageClockOffset(page: Page) {
  let best = { roundTrip: Infinity, offset: 0 };
  for (let i = 0; i < 8; i++) {
    const before = performance.now();
    const inPage = await page.evaluate(() => performance.now());
    const after = performance.now();
    if (after - before < best.roundTrip) best = { roundTrip: after - before, offset: (before + after) / 2 - inPage };
  }
  return best.offset;
}

/**
 * Roda na página antes do app: todo nó de um `AudioContext` ligado aos alto-falantes também é ligado a um
 * `MediaStreamAudioDestinationNode`, gravado por um `MediaRecorder` (um por contexto). O contexto da música
 * (o que usa `createMediaElementSource`) não é gravado — a música entra no ffmpeg, desde o primeiro quadro.
 */
function installAudioTap() {
  type Track = { startedAt: number; chunks: Blob[]; recorder: MediaRecorder };
  const tracks: Track[] = [];
  const music = new WeakSet<BaseAudioContext>();
  const taps = new WeakMap<BaseAudioContext, MediaStreamAudioDestinationNode>();

  (window as unknown as { __demoAudio: Track[] }).__demoAudio = tracks;

  const createMediaElementSource = AudioContext.prototype.createMediaElementSource;
  AudioContext.prototype.createMediaElementSource = function (this: AudioContext, element: HTMLMediaElement) {
    music.add(this);
    return createMediaElementSource.call(this, element);
  };

  const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const result = connect.apply(this, args);
    const ctx = this.context;

    if (args[0] === ctx.destination && ctx instanceof AudioContext && !music.has(ctx)) {
      let tap = taps.get(ctx);
      if (!tap) {
        tap = ctx.createMediaStreamDestination();
        taps.set(ctx, tap);
        const track: Track = { startedAt: performance.now(), chunks: [], recorder: new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192_000 }) };
        track.recorder.ondataavailable = (event) => {
          if (event.data.size > 0) track.chunks.push(event.data);
        };
        track.recorder.onstart = () => {
          track.startedAt = performance.now();
        };
        track.recorder.start(1000);
        tracks.push(track);

        // O Chrome para de renderizar um contexto em silêncio (o relógio congela) e esses trechos sumiriam
        // da gravação, dessincronizando o áudio. Um tom contínuo a -80 dB mantém o contexto sempre rodando.
        const keepAlive = ctx.createOscillator();
        const quiet = ctx.createGain();
        keepAlive.frequency.value = 40;
        quiet.gain.value = 0.0001;
        connect.call(keepAlive, quiet);
        connect.call(quiet, ctx.destination);
        connect.call(quiet, tap);
        keepAlive.start();
      }
      connect.call(this, tap);
    }

    return result;
  } as typeof AudioNode.prototype.connect;
}

/** Para as gravações de `installAudioTap` e devolve cada uma em base64. */
async function collectAudio(page: Page): Promise<AudioTrack[]> {
  return page.evaluate(async () => {
    type Track = { startedAt: number; chunks: Blob[]; recorder: MediaRecorder };
    const tracks = (window as unknown as { __demoAudio?: Track[] }).__demoAudio ?? [];

    return Promise.all(tracks.map((track) => new Promise<{ startedAt: number; recorded: number; data: string }>((resolve) => {
      track.recorder.onstop = async () => {
        const bytes = new Uint8Array(await new Blob(track.chunks, { type: 'audio/webm' }).arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        resolve({ startedAt: track.startedAt, recorded: (performance.now() - track.startedAt) / 1000, data: btoa(binary) });
      };
      track.recorder.stop();
    })));
  });
}

/** Melhor Jogada possível com a mão: testa todas as seleções de 1 a 5 cartas. */
function bestMeld(hand: ICard[]) {
  let best: { cards: ICard[]; points: number } = { cards: [hand[0]], points: -1 };

  const visit = (start: number, picked: ICard[]) => {
    if (picked.length > 0) {
      const points = bestCombo(picked).points;
      // Empate: prefere a seleção menor (as cartas que não pontuam iriam para o Bolo à toa).
      if (points > best.points || (points === best.points && picked.length < best.cards.length)) best = { cards: [...picked], points };
    }
    if (picked.length === 5) return;
    for (let i = start; i < hand.length; i++) visit(i + 1, [...picked, hand[i]]);
  };

  visit(0, []);

  return best;
}

/** As `n` cartas de menor valor fora da melhor Jogada (descarte/troca "sensato"). */
function weakest(hand: ICard[], n: number) {
  const keep = new Set(bestMeld(hand).cards.map((card) => card.id));
  const rest = hand.filter((card) => !keep.has(card.id));
  const pool = rest.length >= n ? rest : hand;

  return [...pool].sort((a, b) => chipsForCard(a) - chipsForCard(b)).slice(0, n);
}

function sql(query: string) {
  const result = spawnSync('docker', ['exec', PG_CONTAINER, 'psql', '-q', '-U', PG_USER, '-d', PG_DB, '-c', query], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`psql falhou: ${result.stderr || result.stdout}`);
}

async function ok(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<any> {
  expect(response.ok(), await response.text()).toBeTruthy();

  return response.json();
}

test('vídeo de demonstração: uma partida', async ({ browser, baseURL }, testInfo) => {
  rmSync(RAW_DIR, { recursive: true, force: true });

  const context = await browser.newContext({
    baseURL,
    viewport: SIZE,
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  // Aquece o cache (fontes, JS) numa página descartável: a frio, a primeira tela demora a pintar.
  const warmup = await context.newPage();
  await warmup.goto('/');
  await warmup.evaluate(() => document.fonts.ready);
  await warmup.close();

  const page = await context.newPage();
  await page.addInitScript(installAudioTap);
  const screencast = await startScreencast(page);
  // O vídeo começa na primeira pintura da home (definida no passo 1); os cortes são medidos a partir dela.
  let videoStart = 0;
  let pageOffset = 0;
  const at = () => (performance.now() - videoStart) / 1000;
  const pause = (ms: number) => page.waitForTimeout(ms);
  const hand = page.getByRole('region', { name: 'Sua mão' });

  const friends: Seat[] = [];
  let host!: Seat;
  let gameId = 0;

  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      await page.screenshot({ path: testInfo.outputPath(`fail-${name}.png`) }).catch(() => {});
      throw error;
    }
  };

  const stateOf = async (seat: Seat): Promise<IGameState> => (await ok(await seat.api.get(`/api/games/${gameId}`))).data;
  const nameOf = (seatNumber: number) => (seatNumber === 0 ? HOST : FRIENDS[seatNumber - 1]);

  /** Espera a vez (como a tela mostra) chegar em `seatNumber` — depois da animação da ação anterior. */
  const waitTurnShown = async (seatNumber: number) => {
    const text = seatNumber === host.seat ? 'Sua vez' : `Vez de ${nameOf(seatNumber)}`;
    await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 25_000 });
  };

  /** Clica nas cartas da mão, uma a uma, como uma pessoa. */
  const pickCards = async (cards: ICard[]) => {
    for (const card of cards) {
      await hand.getByRole('button', { name: `${card.rank} de ${SUIT_NAME[card.suit]}`, exact: true }).click();
      await pause(380);
    }
  };

  /** Tira o mouse de cima da mão: parado sobre uma carta, mostraria o tooltip "Aguarde sua vez". */
  const restMouse = () => page.mouse.move(SIZE.width * 0.5, SIZE.height * 0.32, { steps: 8 });

  // ─── 1. Home ─────────────────────────────────────────────────────────────────────────────
  await step('home', async () => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Criar uma sala' })).toBeVisible();
    pageOffset = await pageClockOffset(page);
    const firstPaint = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? performance.now());
    videoStart = firstPaint + pageOffset;
    await pause(2800);
    await page.getByRole('link', { name: 'Criar uma sala' }).click();
    await pause(1600);
  });

  // ─── 2. Cria a sala ──────────────────────────────────────────────────────────────────────
  await step('create-room', async () => {
    const name = page.getByLabel('Seu nome');
    await name.click();
    await name.pressSequentially(HOST, { delay: 90 });
    await pause(500);
    await page.getByRole('button', { name: 'Criar sala' }).click();
    await expect(page.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
    host = { seat: 0, name: HOST, api: context.request };
    await pause(1600);
  });

  // ─── 3. Os amigos entram ─────────────────────────────────────────────────────────────────
  await step('join', async () => {
    const code = page.url().split('/').pop()!.toUpperCase();
    for (const [i, name] of FRIENDS.entries()) {
      const api = await playwrightRequest.newContext({ baseURL });
      await ok(await api.post(`/api/rooms/${code}/join`, { data: { name } }));
      friends.push({ seat: i + 1, name, api });
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await pause(1100);
    }
    await pause(800);
    await page.getByRole('button', { name: 'Iniciar partida' }).click();
    await page.waitForURL(/\/games\/\d+$/);
    gameId = Number(page.url().split('/').pop());
    await expect(hand.getByRole('button', { name: / de (copas|ouros|paus|espadas)$/ }).first()).toBeVisible();
    await pause(2000);
  });

  // ─── 4. Rodadas: Jogada, Descarte e Troca ─────────────────────────────────────────────────
  // O anfitrião faz uma ação de cada tipo pela tela; os amigos jogam pela API (João descarta na
  // primeira vez, para aparecer o Descarte visto de fora).
  const hostPlan = ['meld', 'discard', 'swap'] as const;
  let hostTurns = 0;
  let joaoDiscarded = false;

  const hostMeld = async () => {
    const state = await stateOf(host);
    const { cards } = bestMeld(state.you!.hand);
    await pickCards(cards);
    await pause(900);
    await hand.getByRole('button', { name: 'Jogada', exact: true }).click();
    await pause(900);
    await hand.getByRole('button', { name: 'Monte', exact: true }).click();
    await restMouse();
  };

  const hostDiscard = async () => {
    const state = await stateOf(host);
    await pickCards(weakest(state.you!.hand, 3));
    await pause(700);
    await hand.getByRole('button', { name: 'Descarte', exact: true }).click();
    await pause(900);
    await hand.getByRole('button', { name: 'Monte', exact: true }).click();
    await restMouse();
  };

  const hostSwap = async () => {
    await hand.getByRole('button', { name: 'Troca', exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await pause(900);
    const quantity = modal.getByRole('textbox');
    await quantity.click();
    await quantity.press('ArrowUp');
    await pause(900);
    await modal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal).toBeHidden();
    await pause(900);

    const state = await stateOf(host);
    await pickCards(weakest(state.you!.hand, 2));
    await pause(600);
    await hand.getByRole('button', { name: 'Confirmar troca' }).click();
    await restMouse();
    await pause(900);

    // O parceiro escolhe as dele em segredo; a troca acontece.
    const partner = friends.find((friend) => friend.seat === 2)!;
    const partnerState = await stateOf(partner);
    await ok(await partner.api.post(`/api/games/${gameId}/swap/choose`, { data: { cards: weakest(partnerState.you!.hand, 2).map((card) => card.id) } }));
  };

  const friendTurn = async (friend: Seat) => {
    const state = await stateOf(friend);
    if (friend.name === 'João' && !joaoDiscarded) {
      joaoDiscarded = true;
      const cards = weakest(state.you!.hand, 2).map((card) => card.id);
      await ok(await friend.api.post(`/api/games/${gameId}/discard`, { data: { cards, source: 'deck' } }));
      return;
    }
    const cards = bestMeld(state.you!.hand).cards.map((card) => card.id);
    await ok(await friend.api.post(`/api/games/${gameId}/meld`, { data: { cards, source: 'deck' } }));
  };

  await step('rounds', async () => {
    while (hostTurns < hostPlan.length) {
      const state = await stateOf(host);
      const seat = state.current_seat;
      await waitTurnShown(seat);
      await pause(seat === host.seat ? 900 : 1300);

      if (seat === host.seat) {
        const action = hostPlan[hostTurns++];
        if (action === 'meld') await hostMeld();
        else if (action === 'discard') await hostDiscard();
        else await hostSwap();
      } else {
        await friendTurn(friends.find((friend) => friend.seat === seat)!);
      }

      // Espera a vez passar na tela (a contagem de pontos da Jogada termina antes).
      await expect.poll(async () => (await stateOf(host)).last_action?.seat, { timeout: 15_000 }).toBe(seat);
      const next = (await stateOf(host)).current_seat;
      await waitTurnShown(next);
    }
    await pause(1800);
  });

  // ─── 5. Transição com a logo ─────────────────────────────────────────────────────────────
  // Cobre a tela com a logo; por baixo, a partida é levada até a última Jogada. O vídeo corta do meio
  // da logo (parada) para o meio da logo de novo, então o salto não aparece.
  let cutOut = 0;
  let cutIn = 0;

  await step('transition', async () => {
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.id = 'demo-logo-transition';
      overlay.className = 'felt-surface-deep';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;opacity:0;';
      overlay.innerHTML = `
        <img src="/icon.svg" alt="" style="width:168px;height:168px;border-radius:20px;box-shadow:0 24px 60px -20px rgba(0,0,0,.7)">
        <span class="font-display" style="color:var(--color-paper, #f5efe2);font-size:64px;line-height:1;letter-spacing:-0.01em">Cross Poker</span>`;
      document.body.appendChild(overlay);
      const [logo, title] = overlay.children as unknown as HTMLElement[];
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 550, easing: 'ease-out', fill: 'forwards' });
      logo.animate(
        [{ transform: 'scale(.55) rotate(-90deg)', opacity: 0 }, { transform: 'scale(1.06) rotate(6deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotate(0)', opacity: 1 }],
        { duration: 900, delay: 200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      );
      title.animate([{ transform: 'translateY(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 650, easing: 'ease-out', fill: 'both' });
    });
    // Animação de entrada (~1,3s) + um pouco da logo parada.
    await pause(1300 + 900);
    cutOut = at();

    // Por baixo da logo: só o jogador da vez tem uma Jogada; ela encerra a partida (nenhum jogador fica
    // com Jogadas). O placar ganha os pontos de uma partida inteira, com a equipe do anfitrião na frente.
    const state = await stateOf(host);
    const last = state.current_seat;
    const lastSeat = last === host.seat ? host : friends.find((friend) => friend.seat === last)!;
    const lastMeld = bestMeld((await stateOf(lastSeat)).you!.hand);
    const teamBonus = [1184 + Math.max(0, lastMeld.points - 250), 726];
    const bonus = [0, 1, 2, 3].map((seat) => {
      const share = seat < 2 ? 0.54 : 0.46;
      return Math.round(teamBonus[seat % 2] * share);
    });
    sql(`UPDATE game_players SET
      melds_remaining = CASE WHEN seat = ${last} THEN 1 ELSE 0 END,
      discards_remaining = 0,
      score = score + CASE seat WHEN 0 THEN ${bonus[0]} WHEN 1 THEN ${bonus[1]} WHEN 2 THEN ${bonus[2]} ELSE ${bonus[3]} END
      WHERE game_id = ${gameId};`);

    await ok(await lastSeat.api.post(`/api/games/${gameId}/meld`, { data: { cards: lastMeld.cards.map((card) => card.id), source: 'deck' } }));

    // A animação de encerramento começa quando a contagem da última Jogada termina (por baixo da logo).
    await page.waitForFunction(() => !!document.querySelector('[class*="z-300"]'), undefined, { timeout: 30_000, polling: 'raf' });
    cutIn = at() - 1.0;
    await page.evaluate(() => {
      const overlay = document.getElementById('demo-logo-transition')!;
      overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' })
        .finished.then(() => overlay.remove());
    });
  });

  // ─── 6. Fim da partida ───────────────────────────────────────────────────────────────────
  await step('result', async () => {
    await expect(page.locator('#resultado-titulo')).toBeVisible({ timeout: 15_000 });
    await pause(6500);
  });
  const endedAt = at();
  const frames = await screencast.stop();
  const audio = await collectAudio(page);

  await context.close();
  for (const friend of friends) await friend.api.dispose();

  // Quadros e áudio no mesmo eixo: segundos desde a primeira pintura.
  const timeline = frames.map((frame) => ({ ...frame, at: (frame.at - videoStart) / 1000 }));
  const tracks = saveAudio(audio).map((track) => ({ ...track, offset: (track.startedAt + pageOffset - videoStart) / 1000 }));
  saveVideo(timeline, [[0, cutOut], [cutIn, endedAt]], tracks);
  rmSync(FRAMES_DIR, { recursive: true, force: true });
});

/** Duração (s) de um áudio, decodificando-o (o webm do `MediaRecorder` não traz a duração no cabeçalho). */
function audioDuration(file: string): number {
  const probe = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const times = [...(probe.stderr ?? '').matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
  const last = times.at(-1);
  return last ? Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) : 0;
}

/** Grava as faixas de áudio da página em disco. */
function saveAudio(tracks: AudioTrack[]) {
  mkdirSync(RAW_DIR, { recursive: true });
  return tracks.map((track, i) => {
    const file = path.join(RAW_DIR, `sfx-${i}.webm`);
    writeFileSync(file, Buffer.from(track.data, 'base64'));
    return { file, startedAt: track.startedAt, recorded: track.recorded };
  });
}

/** Volume dos efeitos sonoros e da música no vídeo (o jogo toca os efeitos baixinho, sob a música). */
const SFX_GAIN = 2.6;
const MUSIC_GAIN = 0.55;

/**
 * Lista do concat do ffmpeg com os quadros dos trechos, já cortados e juntados: cada quadro fica na tela
 * até o próximo (o screencast só manda quadro quando a tela muda).
 */
function frameList(frames: Frame[], segments: [number, number][]) {
  const lines = ['ffconcat version 1.0'];
  let last = '';

  for (const [from, to] of segments) {
    let i = Math.max(0, frames.findLastIndex((frame) => frame.at <= from));
    let cursor = from;
    while (cursor < to && i < frames.length) {
      const end = Math.min(frames[i + 1]?.at ?? Infinity, to);
      if (end > cursor) {
        lines.push(`file '${frames[i].file}'`, `duration ${(end - cursor).toFixed(4)}`);
        last = frames[i].file;
      }
      cursor = Math.max(cursor, end);
      i++;
    }
  }
  // O concat ignora a duração da última entrada: repete o último quadro.
  lines.push(`file '${last}'`);

  const list = path.join(RAW_DIR, 'frames.ffconcat');
  writeFileSync(list, `${lines.join('\n')}\n`);
  return list;
}

/**
 * Junta os trechos (quadros e efeitos sonoros gravados na página, com os mesmos cortes) e mixa a música da
 * partida desde o primeiro quadro, com fade no começo e no fim. A música abaixa por instantes sob os efeitos
 * (compressor com sidechain), como o jogo faz com os avisos de vez. Tempos em segundos desde a primeira pintura.
 */
function saveVideo(frames: Frame[], segments: [number, number][], tracks: (ReturnType<typeof saveAudio>[number] & { offset: number })[]) {
  mkdirSync(VIDEO_DIR, { recursive: true });
  const target = path.join(VIDEO_DIR, 'demo.mp4');

  const sfx = tracks.map(({ file, offset, recorded }, i) => {
    console.log(`Efeitos ${i}: começam em ${offset.toFixed(2)}s (${recorded.toFixed(1)}s gravados, ${audioDuration(file).toFixed(1)}s no arquivo)`);
    return { file, offset: Math.max(0, offset) };
  });
  console.log(`Quadros: ${frames.length} em ${(frames.at(-1)!.at - frames[0].at).toFixed(1)}s`);

  const total = segments.reduce((sum, [from, to]) => sum + (to - from), 0);
  const musicInput = 1 + sfx.length;
  const n = segments.length;

  const video = `[0:v]scale=${SIZE.width}:${SIZE.height},fps=30,format=yuv420p,trim=end=${total.toFixed(3)},fade=t=out:st=${(total - 1.2).toFixed(3)}:d=1.2[v]`;

  // Efeitos: cada faixa no seu instante do vídeo cru (silêncio antes e depois), mesmos cortes do vídeo.
  const effects = sfx.length > 0
    ? [
      ...sfx.map(({ offset }, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(offset * 1000)}:all=1,apad[s${i}]`),
      `${sfx.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sfx.length}:normalize=0:duration=longest,asplit=${n}${segments.map((_, i) => `[sc${i}]`).join('')}`,
      ...segments.map(([from, to], i) => `[sc${i}]atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=${(to - from - 0.08).toFixed(3)}:d=0.08[a${i}]`),
      `${segments.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1,volume=${SFX_GAIN},asplit=2[fx][key]`,
    ]
    : [`anullsrc=r=48000:cl=stereo,atrim=0:${total.toFixed(3)}[fx]`, `anullsrc=r=48000:cl=stereo,atrim=0:${total.toFixed(3)}[key]`];

  const music = `[${musicInput}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,volume=${MUSIC_GAIN},afade=t=in:d=1.5[m]`;
  const duck = '[m][key]sidechaincompress=threshold=0.03:ratio=4:attack=15:release=450[md]';
  const mix = `[md][fx]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95,afade=t=out:st=${(total - 2.5).toFixed(3)}:d=2.5[a]`;

  const result = spawnSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0', '-i', frameList(frames, segments),
    ...sfx.flatMap(({ file }) => ['-i', file]),
    '-stream_loop', '-1', '-i', MUSIC,
    '-filter_complex', [video, ...effects, music, duck, mix].join(';'),
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest',
    target,
  ], { stdio: 'inherit' });

  if (result.error || result.status !== 0) throw new Error('ffmpeg falhou ao gerar o vídeo');
  console.log(`Vídeo salvo em ${target} (${total.toFixed(1)}s, ${sfx.length} faixa(s) de efeitos)`);
}
