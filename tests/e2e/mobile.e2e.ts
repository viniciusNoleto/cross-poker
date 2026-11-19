import { expect, handOf, openTable, pickCards, rigTable, test } from './support/fixtures';

// Roda nos dois projetos (desktop e celular): a mesa precisa caber e funcionar em telas pequenas.
test('mesa cabe na tela e a Jogada funciona', async ({ table }) => {
  await rigTable(table.gameId);

  const [ana] = table.seats;

  await openTable(ana, table.gameId);

  // Sem rolagem horizontal.
  const overflow = await ana.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  expect(overflow).toBeLessThanOrEqual(1);

  const hand = handOf(ana.page);

  await expect(hand.getByRole('button', { name: 'Jogada', exact: true })).toBeInViewport();

  await pickCards(ana.page, ['hearts-8', 'spades-8']);
  await hand.getByRole('button', { name: 'Jogada', exact: true }).click();
  await hand.getByRole('button', { name: 'Monte', exact: true }).click();

  await expect(ana.page.getByText('Vez de Bruno', { exact: true })).toBeVisible({ timeout: 25_000 });
});
