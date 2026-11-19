import { expect, type Page, test } from '@playwright/test';

test.describe('Home', () => {
  test('apresenta o jogo e leva ao formulário de criar sala', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Cross Poker/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Criar uma sala' }).click();

    await expect(page).toHaveURL(/#jogar$/);
    await expect(page.getByRole('heading', { name: 'Puxe uma cadeira.' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Criar sala' })).toBeVisible();
  });

  test('criar sala sem nome não envia nada', async ({ page }) => {
    await page.goto('/#jogar');

    let posted = false;

    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/rooms')) posted = true;
    });

    await page.getByRole('button', { name: 'Criar sala' }).click();

    // O campo é `required`: o navegador barra o envio antes mesmo da validação do formulário.
    expect(await page.getByLabel('Seu nome').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    await expect(page).toHaveURL(/\/#jogar$/);
    expect(posted).toBe(false);
  });

  test('criar sala leva à sala de espera, com você como anfitrião', async ({ page }) => {
    await page.goto('/#jogar');
    await page.getByLabel('Seu nome').fill('Ana');
    await page.getByRole('button', { name: 'Criar sala' }).click();

    await expect(page).toHaveURL(/\/rooms\/[A-Z0-9]{6}$/);
    await expect(page.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
    await expect(page.getByText('Equipe A · anfitrião · você')).toBeVisible();
    await expect(page.getByText('1 de 4 na mesa')).toBeVisible();
  });

  test('"Já tenho um código" entra numa sala existente', async ({ page, browser, baseURL }) => {
    const host = await browser.newContext({ baseURL });
    const created = await (await host.request.post('/api/rooms', { data: { name: 'Ana' } })).json();
    const code: string = created.data.room.code;

    await page.goto('/');
    await page.getByRole('link', { name: 'Já tenho um código' }).click();
    await page.getByLabel('Seu nome').fill('Bruno');
    await page.getByLabel('Código da sala').fill(code.toLowerCase());
    await page.getByRole('button', { name: 'Entrar na sala' }).click();

    await expect(page).toHaveURL(new RegExp(`/rooms/${code}$`));
    await expect(page.getByText('Equipe B · você')).toBeVisible();
    await expect(page.getByText('Ana', { exact: true })).toBeVisible();

    await host.close();
  });

  async function joinMissingRoom(page: Page) {
    await page.goto('/');
    await page.getByRole('link', { name: 'Já tenho um código' }).click();
    await page.getByLabel('Seu nome').fill('Bruno');
    await page.getByLabel('Código da sala').fill('ZZZZZZ');
    await page.getByRole('button', { name: 'Entrar na sala' }).click();
  }

  test('código inexistente: avisa o erro e continua na home', async ({ page }) => {
    await joinMissingRoom(page);

    await expect(page.locator('.mantine-Notification-root').getByText('Erro', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/#jogar$/);
  });

  // BUG conhecido (ver tests/unit/logics/logics.test.tsx): a notificação sai sem a mensagem da API.
  // Quando for corrigido, este teste passa e o Playwright acusa — aí é só tirar o `test.fail()`.
  test('código inexistente: a notificação explica o erro (bug conhecido)', async ({ page }) => {
    test.fail();

    await joinMissingRoom(page);

    await expect(page.getByText('Sala não encontrada.')).toBeVisible({ timeout: 5000 });
  });

  test('alternar entre criar e entrar no formulário', async ({ page }) => {
    await page.goto('/#jogar');
    await expect(page.getByLabel('Código da sala')).toHaveCount(0);

    await page.getByText('Tenho um código', { exact: true }).click();
    await expect(page.getByLabel('Código da sala')).toBeVisible();

    await page.getByText('Criar sala', { exact: true }).click();
    await expect(page.getByLabel('Código da sala')).toHaveCount(0);
  });
});
