import { type BrowserContext, expect, test } from '@playwright/test';

test.describe('Sala de espera', () => {
  test('quatro amigos entram, a mesa enche em tempo real e o anfitrião inicia para todos', async ({ browser, baseURL }) => {
    const contexts: BrowserContext[] = [];
    const open = async () => {
      const context = await browser.newContext({ baseURL });

      contexts.push(context);

      return context.newPage();
    };

    // Anfitriã cria pela tela.
    const ana = await open();

    await ana.goto('/#jogar');
    await ana.getByLabel('Seu nome').fill('Ana');
    await ana.getByRole('button', { name: 'Criar sala' }).click();
    await expect(ana).toHaveURL(/\/rooms\/[A-Z0-9]{6}$/);

    const code = ana.url().split('/').pop()!;
    const start = ana.getByRole('button', { name: /Aguardando jogadores|Iniciar partida/ });

    await expect(ana.getByRole('button', { name: `Copiar código da sala ${code}` })).toBeVisible();
    await expect(start).toHaveText('Aguardando jogadores (1/4)');
    await expect(start).toBeDisabled();

    // Os amigos entram pelo link da sala (sem cookie: a sala mostra a mesa, eles entram pela API do
    // próprio navegador, como faria o formulário da home) e a tela de Ana atualiza sozinha (SSE).
    const guests = [];

    for (const [index, name] of ['Bruno', 'Carla', 'Diego'].entries()) {
      const page = await open();

      await page.request.post(`/api/rooms/${code}/join`, { data: { name } });
      await page.goto(`/rooms/${code}`);
      await expect(page.getByText(`Aguardando o anfitrião iniciar a partida (${index + 2}/4 jogadores).`)).toBeVisible();
      await expect(ana.getByText(name, { exact: true })).toBeVisible();
      guests.push(page);
    }

    await expect(ana.getByText('4 de 4 na mesa')).toBeVisible();
    await expect(ana.getByText('Lugar livre')).toHaveCount(0);
    // Parceiros frente a frente: Carla (assento 2) é da Equipe A, com Ana.
    await expect(guests[1].getByText('Equipe A · você')).toBeVisible();

    await expect(start).toHaveText('Iniciar partida');
    await start.click();

    // Todo mundo vai para a mesa: Ana pelo retorno da requisição, os outros pelo evento SSE da sala.
    for (const page of [ana, ...guests]) {
      await expect(page).toHaveURL(/\/games\/\d+$/);
      await expect(page.getByRole('region', { name: 'Sua mão' })).toBeVisible();
    }

    await Promise.all(contexts.map((context) => context.close()));
  });

  test('copiar o código da sala', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#jogar');
    await page.getByLabel('Seu nome').fill('Ana');
    await page.getByRole('button', { name: 'Criar sala' }).click();
    await expect(page).toHaveURL(/\/rooms\/[A-Z0-9]{6}$/);

    const code = page.url().split('/').pop()!;

    await page.getByRole('button', { name: `Copiar código da sala ${code}` }).click();

    await expect(page.getByText('Código copiado!')).toBeVisible();
  });

  test('quinto jogador não entra (sala cheia)', async ({ browser, baseURL }) => {
    // BUG conhecido (ver tests/unit/logics/logics.test.tsx): a notificação sai sem a mensagem da API
    // ("Esta sala já está cheia."). Quando for corrigido, tire o `test.fail()`.
    test.fail();

    const host = await browser.newContext({ baseURL });
    const { data } = await (await host.request.post('/api/rooms', { data: { name: 'Ana' } })).json();

    for (const name of ['B', 'C', 'D']) {
      const guest = await browser.newContext({ baseURL });

      await guest.request.post(`/api/rooms/${data.room.code}/join`, { data: { name } });
      await guest.close();
    }

    const late = await browser.newContext({ baseURL });
    const page = await late.newPage();

    await page.goto('/');
    await page.getByRole('link', { name: 'Já tenho um código' }).click();
    await page.getByLabel('Seu nome').fill('Eva');
    await page.getByLabel('Código da sala').fill(data.room.code);
    await page.getByRole('button', { name: 'Entrar na sala' }).click();

    await expect(page).toHaveURL(/\/#jogar$/);
    await expect(page.getByText('Esta sala já está cheia.')).toBeVisible({ timeout: 5000 });

    await host.close();
    await late.close();
  });
});
