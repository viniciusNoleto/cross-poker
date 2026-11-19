import { cardName, expect, handOf, HANDS, ids, openTable, pickCards, rigTable, test } from './support/fixtures';

// Mesa conhecida em todos os testes: Ana (assento 0) começa, com um par de 8 na mão.
test.beforeEach(async ({ table }) => {
  await rigTable(table.gameId);
});

test.describe('Mesa', () => {
  test('cada jogador vê a própria mão, a vez e os contadores da mesa', async ({ table }) => {
    const [ana, bruno] = table.seats;

    await openTable(ana, table.gameId);
    await openTable(bruno, table.gameId);

    await expect(ana.page.getByText('Sua vez', { exact: true })).toBeVisible();
    await expect(bruno.page.getByText('Vez de Ana', { exact: true })).toBeVisible();

    // 8 cartas na mão de cada um, e nenhuma carta de Ana na tela de Bruno.
    await expect(handOf(ana.page).getByRole('button', { name: / de / })).toHaveCount(8);
    await expect(bruno.page.getByRole('button', { name: cardName('hearts-8') })).toHaveCount(0);

    await expect(ana.page.getByText('Monte (20)')).toBeVisible();
    await expect(ana.page.getByText('Descarte (0)')).toBeVisible();
    await expect(ana.page.getByRole('button', { name: 'Ver o Bolo (0 cartas)' })).toBeVisible();
    await expect(ana.page.getByLabel('8 cartas na mão')).toHaveCount(3);

    // Fora da vez, as ações ficam travadas.
    await pickCards(bruno.page, ['clubs-A']);
    await expect(handOf(bruno.page).getByRole('button', { name: 'Jogada' })).toBeDisabled();
    await expect(handOf(bruno.page).getByRole('button', { name: 'Descarte' })).toBeDisabled();
    await expect(handOf(bruno.page).getByRole('button', { name: 'Troca' })).toBeDisabled();
  });

  test('Jogada: prévia da combinação, escolha da origem e pontuação animada para todos', async ({ table }) => {
    const [ana, bruno] = table.seats;

    await openTable(ana, table.gameId);
    await openTable(bruno, table.gameId);

    const hand = handOf(ana.page);

    await expect(hand.getByText('Selecione de 1 a 5 cartas')).toBeVisible();
    await pickCards(ana.page, ['hearts-8', 'spades-8', 'clubs-K']);
    await expect(hand.getByRole('button', { name: cardName('hearts-8') })).toHaveAttribute('aria-pressed', 'true');
    await expect(hand.getByText('Par · 52 pts')).toBeVisible();

    await hand.getByRole('button', { name: 'Jogada', exact: true }).click();
    await expect(hand.getByText('Jogada · comprar 3 carta(s) de:')).toBeVisible();
    // Descarte vazio: só o Monte serve.
    await expect(hand.getByRole('button', { name: 'Descarte', exact: true })).toBeDisabled();
    await hand.getByRole('button', { name: 'Monte', exact: true }).click();

    // A contagem de pontos aparece para os dois ao mesmo tempo (Bruno vê quem jogou).
    for (const page of [ana.page, bruno.page]) {
      await expect(page.getByText('= 52 pontos')).toBeVisible({ timeout: 20_000 });
    }

    // Depois da contagem: vez de Bruno, placar e Bolo atualizados, mão de Ana de volta a 8.
    await expect(bruno.page.getByText('Sua vez', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(ana.page.getByText('Vez de Bruno', { exact: true })).toBeVisible();
    await expect(ana.page.getByRole('button', { name: 'Ver o Bolo (3 cartas)' })).toBeVisible();
    await expect(ana.page.getByText('Monte (17)')).toBeVisible();
    await expect(handOf(ana.page).getByRole('button', { name: / de / })).toHaveCount(8);
    await expect(ana.page.getByLabel('Jogadas: 4 de 5')).toBeVisible();

    const state = await table.state(1);

    expect(state.players[0].score).toBe(52);
    expect(state.last_action).toMatchObject({ type: 'meld', combo: 'pair', points: 52 });
  });

  test('Descarte comprando do Descarte, visto de fora só como contagem', async ({ table }) => {
    await rigTable(table.gameId, { discard: ids('hearts-J', 'hearts-Q', 'hearts-K') });

    const [ana, , carla] = table.seats;

    await openTable(ana, table.gameId);
    await openTable(carla, table.gameId);

    const hand = handOf(ana.page);

    await pickCards(ana.page, ['hearts-2', 'hearts-3']);
    await hand.getByRole('button', { name: 'Descarte', exact: true }).click();
    await expect(hand.getByText('Descarte · comprar 2 carta(s) de:')).toBeVisible();
    await hand.getByRole('button', { name: 'Descarte', exact: true }).click();

    // Comprou as duas do topo (Q e K de copas) e as descartadas foram para o topo do Descarte.
    await expect(hand.getByRole('button', { name: 'Q de copas' })).toBeVisible();
    await expect(hand.getByRole('button', { name: 'K de copas' })).toBeVisible();
    await expect(hand.getByRole('button', { name: '2 de copas' })).toHaveCount(0);
    await expect(ana.page.getByText('Descarte (3)')).toBeVisible();
    await expect(ana.page.getByLabel('Descartes: 4 de 5')).toBeVisible();

    // Carla não vê quais cartas foram compradas.
    await expect(carla.page.getByText('Vez de Bruno', { exact: true })).toBeVisible();
    await expect(carla.page.getByRole('button', { name: 'Q de copas' })).toHaveCount(0);

    const asCarla = await table.state(2);

    expect(asCarla.last_action).toMatchObject({ type: 'discard', discarded_count: 2, drawn_count: 2 });
    expect(asCarla.last_action?.drawn_cards).toBeUndefined();
  });

  test('Cancelar a escolha da origem não envia nada e destrava a seleção', async ({ table }) => {
    const [ana] = table.seats;

    await openTable(ana, table.gameId);

    const hand = handOf(ana.page);

    await pickCards(ana.page, ['hearts-8']);
    await hand.getByRole('button', { name: 'Jogada', exact: true }).click();
    await hand.getByRole('button', { name: 'Cancelar' }).click();

    await expect(hand.getByRole('button', { name: 'Jogada', exact: true })).toBeEnabled();
    await expect(ana.page.getByText('Sua vez', { exact: true })).toBeVisible();
    expect((await table.state(0)).last_action).toBeNull();

    // Desmarcar a carta volta à dica inicial.
    await pickCards(ana.page, ['hearts-8']);
    await expect(hand.getByText('Selecione de 1 a 5 cartas')).toBeVisible();
  });

  test('no máximo 5 cartas selecionadas', async ({ table }) => {
    const [ana] = table.seats;

    await openTable(ana, table.gameId);
    await pickCards(ana.page, ['hearts-8', 'spades-8', 'hearts-2', 'hearts-3', 'hearts-4', 'clubs-K']);

    await expect(handOf(ana.page).getByRole('button', { pressed: true })).toHaveCount(5);
    await expect(handOf(ana.page).getByRole('button', { name: 'K de paus' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('ordenar a mão por naipe e por valor', async ({ table }) => {
    const [ana] = table.seats;

    await openTable(ana, table.gameId);

    const names = () => handOf(ana.page).getByRole('button', { name: / de / }).evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')));

    await handOf(ana.page).getByRole('button', { name: 'Valor' }).click();
    await expect.poll(names).toEqual(['2 de copas', '3 de copas', '3 de ouros', '4 de copas', '5 de espadas', '8 de espadas', '8 de copas', 'K de paus']);

    await handOf(ana.page).getByRole('button', { name: 'Naipe' }).click();
    await expect.poll(names).toEqual(['5 de espadas', '8 de espadas', '2 de copas', '3 de copas', '4 de copas', '8 de copas', 'K de paus', '3 de ouros']);
  });

  test('Troca entre parceiros: escolhas secretas e troca simultânea', async ({ table }) => {
    const [ana, bruno, carla] = table.seats;

    await openTable(ana, table.gameId);
    await openTable(carla, table.gameId);
    await openTable(bruno, table.gameId);

    // Fase 1: Ana declara 2 cartas.
    await handOf(ana.page).getByRole('button', { name: 'Troca', exact: true }).click();

    const modal = ana.page.getByRole('dialog', { name: 'Troca' });

    await expect(modal.getByText('Carla entrega')).toBeVisible();
    await modal.getByRole('textbox').fill('2');
    await expect(modal.getByText('Cada um escolhe 2 carta(s) em segredo para trocar.')).toBeVisible();
    await modal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal).toBeHidden();

    // Todos veem que há uma troca; só os dois participantes escolhem.
    for (const page of [ana.page, bruno.page, carla.page]) {
      await expect(page.getByText('Troca em andamento entre Ana e Carla...')).toBeVisible();
    }

    await expect(handOf(bruno.page).getByRole('button', { name: 'Confirmar troca' })).toHaveCount(0);

    // Fase 2: cada um escolhe 2 cartas, em qualquer ordem — Carla mesmo fora da vez.
    await pickCards(carla.page, ['diamonds-A', 'diamonds-2']);
    await expect(handOf(carla.page).getByText('Escolha 2 carta(s) da sua mão para a troca (2/2)')).toBeVisible();
    await handOf(carla.page).getByRole('button', { name: 'Confirmar troca' }).click();
    await expect(handOf(carla.page).getByText('Aguardando seu parceiro escolher as cartas da troca...')).toBeVisible();

    await pickCards(ana.page, ['hearts-2', 'hearts-3']);
    await handOf(ana.page).getByRole('button', { name: 'Confirmar troca' }).click();

    // As cartas cruzaram; cada um gastou 1 Descarte; a vez passou para Bruno.
    await expect(handOf(ana.page).getByRole('button', { name: 'A de ouros' })).toBeVisible();
    await expect(handOf(ana.page).getByRole('button', { name: '2 de copas' })).toHaveCount(0);
    await expect(handOf(carla.page).getByRole('button', { name: '2 de copas' })).toBeVisible();
    await expect(bruno.page.getByText('Sua vez', { exact: true })).toBeVisible();
    await expect(bruno.page.getByText(/Troca em andamento/)).toHaveCount(0);

    const asBruno = await table.state(1);

    expect(asBruno.players.map((p) => p.discards_remaining)).toEqual([4, 5, 4, 5]);
    expect(asBruno.last_action).toMatchObject({ type: 'swap', seat: 0, partner_seat: 2, swap_quantity: 2 });
  });

  test('Bolo: abre a lista das cartas jogadas', async ({ table }) => {
    const [ana] = table.seats;

    await openTable(ana, table.gameId);
    await pickCards(ana.page, ['hearts-8', 'spades-8']);
    await handOf(ana.page).getByRole('button', { name: 'Jogada', exact: true }).click();
    await handOf(ana.page).getByRole('button', { name: 'Monte', exact: true }).click();

    const pile = ana.page.getByRole('button', { name: 'Ver o Bolo (2 cartas)' });

    await expect(pile).toBeVisible({ timeout: 20_000 });
    await pile.click();

    const dialog = ana.page.getByRole('dialog', { name: 'Bolo' });

    await expect(dialog.getByRole('button', { name: '8 de copas' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '8 de espadas' })).toBeVisible();

    await ana.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('"Como pontuar" mostra a tabela de combinações', async ({ table }) => {
    const [ana] = table.seats;

    await openTable(ana, table.gameId);
    await ana.page.getByRole('button', { name: 'Como pontuar' }).click();

    const dialog = ana.page.getByRole('dialog', { name: 'Combinações e pontuação' });

    for (const combo of ['Carta Alta', 'Par', 'Dois Pares', 'Trinca', 'Sequência', 'Flush', 'Full House', 'Quadra', 'Straight Flush']) {
      await expect(dialog.getByText(combo, { exact: true }).first()).toBeVisible();
    }
  });

  test('aviso de fim antecipado quando só uma equipe ainda tem Jogadas', async ({ table }) => {
    await rigTable(table.gameId, { players: { 1: { melds_remaining: 0, score: 300 }, 3: { melds_remaining: 0 } } });

    const [ana] = table.seats;

    await openTable(ana, table.gameId);

    await expect(ana.page.getByText(/A Equipe B não tem mais jogadas\. A partida acaba assim que a Equipe A passar à frente/)).toBeVisible();
  });
});

test.describe('Fim da Partida', () => {
  test('a última Jogada encerra a partida: animação final e resultado por equipe para todos', async ({ table }) => {
    await rigTable(table.gameId, {
      players: {
        0: { melds_remaining: 1, score: 100 },
        1: { melds_remaining: 0, score: 40 },
        2: { melds_remaining: 0, score: 60 },
        3: { melds_remaining: 0, score: 30 },
      },
    });

    const [ana, bruno] = table.seats;

    await openTable(ana, table.gameId);
    await openTable(bruno, table.gameId);
    await pickCards(ana.page, ['hearts-8', 'spades-8']);
    await handOf(ana.page).getByRole('button', { name: 'Jogada', exact: true }).click();
    await handOf(ana.page).getByRole('button', { name: 'Monte', exact: true }).click();

    // 100 + 52 + 60 = 212 contra 70.
    await expect(ana.page.getByRole('heading', { name: 'Equipe A venceu!' })).toBeVisible({ timeout: 40_000 });
    await expect(ana.page.getByText('Sua dupla venceu a partida.')).toBeVisible();
    await expect(ana.page.getByText('Todas as jogadas foram usadas.')).toBeVisible();
    const result = ana.page.getByRole('region', { name: 'Equipe A venceu!' });

    await expect(result.getByText('212', { exact: true })).toBeVisible();
    await expect(result.getByText('70', { exact: true })).toBeVisible();
    await expect(ana.page.getByText('Ana (você)')).toBeVisible();

    await expect(bruno.page.getByRole('heading', { name: 'Equipe A venceu!' })).toBeVisible({ timeout: 40_000 });
    await expect(bruno.page.getByText('Sua dupla perdeu desta vez.')).toBeVisible();

    // Quem abre a partida já encerrada vai direto ao resultado.
    const [, , carla] = table.seats;

    await carla.page.goto(`/games/${table.gameId}`);
    await expect(carla.page.getByRole('heading', { name: 'Equipe A venceu!' })).toBeVisible();

    // A sala encerrada também leva ao resultado.
    await carla.page.goto(`/rooms/${table.code}`);
    await expect(carla.page).toHaveURL(new RegExp(`/games/${table.gameId}$`));

    await result.getByRole('link', { name: 'Voltar ao início' }).click();
    await expect(ana.page).toHaveURL(/\/$/);
  });

  test('fim antecipado (decided) explica o motivo', async ({ table }) => {
    await rigTable(table.gameId, {
      players: {
        0: { melds_remaining: 2, score: 0 },
        1: { melds_remaining: 0, score: 40 },
        2: { melds_remaining: 1, score: 0 },
        3: { melds_remaining: 0, score: 0 },
      },
    });

    const [ana] = table.seats;

    await openTable(ana, table.gameId);
    await pickCards(ana.page, ['hearts-8', 'spades-8']);
    await handOf(ana.page).getByRole('button', { name: 'Jogada', exact: true }).click();
    await handOf(ana.page).getByRole('button', { name: 'Monte', exact: true }).click();

    await expect(ana.page.getByText(/^Fim antecipado: a Equipe B já tinha usado todas as suas jogadas/)).toBeVisible({ timeout: 40_000 });
  });
});

test('as cartas de cada mão são as distribuídas', async ({ table }) => {
  for (const seat of [0, 1, 2, 3]) {
    expect((await table.state(seat)).you?.hand.map((card) => card.id)).toEqual(HANDS[seat]);
  }
});
