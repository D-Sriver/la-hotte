// Téléphone : menu du bas, affichage de « Ma liste » en colonnes, rien qui déborde.
// Le viewport est celui d'un iPhone (375 px) : Chrome de bureau ne descend pas assez bas pour le tester à la main.
import { test, expect } from '@playwright/test';

const run = Date.now().toString(36);
const email = `mia-${run}@mobile.test`;
const PHONE = { width: 375, height: 667 };
const WIDE_PHONE = { width: 500, height: 900 };

// Un pixel (JPEG, le seul format accepté) : de quoi avoir une photo sur chaque envie.
const PIXEL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

test.beforeAll(async ({ request }) => {
  const call = async (method, path, data, family) => {
    const response = await request.fetch(`/api${path}`, {
      method,
      headers: { 'x-dev-email': email, ...(family ? { 'x-family': String(family) } : {}) },
      data,
    });
    expect(response.ok(), `${method} ${path} : ${response.status()}`).toBeTruthy();
    return response.json();
  };
  await call('PUT', '/me', { name: 'Mia', likes: 'Lecture' });
  // Sans famille, l’app n’affiche pas les listes.
  const { family } = await call('POST', '/families', { name: 'Famille Mobile' });
  for (const title of [
    'Sécateur de jardin',
    'Écharpe en laine très douce et longue',
    'Livre de cuisine',
    'Casque audio',
  ])
    await call(
      'POST',
      '/wishes',
      { title, price: '≈ 30 €', note: 'Couleur au choix', photos: [{ data: PIXEL, frame: null }] },
      family.id,
    );
});

const openList = async (page) => {
  await page.goto(`/?as=${encodeURIComponent(email)}#/moi`);
  await page.locator('.wish').first().waitFor();
};
const noSideScroll = (page) => page.locator('html').evaluate((root) => root.scrollWidth <= root.clientWidth);
const columnsOf = (page) =>
  page
    .locator('.wish')
    .evaluateAll((cards) => new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size);

test.describe('iPhone 375 px', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test('menu du bas : icônes seules, centré, dans l’écran', async ({ page }) => {
    await openList(page);
    const bar = await page.locator('.tabs').boundingBox();
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(PHONE.width);
    expect(Math.abs(bar.x + bar.width / 2 - PHONE.width / 2)).toBeLessThan(2);
    // Libellés cachés à l’œil mais gardés pour les lecteurs d’écran.
    for (const label of ['Famille', 'Ma liste', 'Profil']) {
      const tab = page.locator('.tabs').getByRole('link', { name: label });
      await expect(tab).toBeVisible();
      expect((await tab.locator('span').boundingBox()).width).toBeLessThanOrEqual(1);
    }
    expect(await noSideScroll(page)).toBe(true);
  });

  test('Ma liste : pas de 3 colonnes, 2 colonnes et compact, choix mémorisé', async ({ page }) => {
    await openList(page);
    await expect(page.getByRole('button', { name: '3 colonnes' })).toHaveCount(0);

    expect(await columnsOf(page)).toBe(1);
    await page.getByRole('button', { name: '2 colonnes' }).click();
    await expect.poll(() => columnsOf(page)).toBe(2);
    expect(await noSideScroll(page)).toBe(true);

    await page.reload();
    await page.locator('.wish').first().waitFor();
    await expect(page.getByRole('button', { name: '2 colonnes' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /^Compact/ }).click();
    await expect(page.locator('.wish img')).toHaveCount(0);
    expect(await columnsOf(page)).toBe(1);
  });

  test('un « 3 colonnes » mémorisé retombe sur 2 colonnes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('la-hotte-vue-liste', '3'));
    await openList(page);
    expect(await columnsOf(page)).toBe(2);
  });
});

test.describe('téléphone large 500 px', () => {
  test.use({ viewport: WIDE_PHONE, isMobile: true, hasTouch: true });

  test('3 colonnes proposées, sans débordement', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: '3 colonnes' }).click();
    await expect.poll(() => columnsOf(page)).toBe(3);
    expect(await noSideScroll(page)).toBe(true);
  });
});
