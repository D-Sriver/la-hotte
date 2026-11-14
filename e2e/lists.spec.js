// Ma liste : cadeaux reçus saisis à la main (de qui, quand, modification), tri et filtre.
import { test, expect } from '@playwright/test';

const run = Date.now().toString(36);
const email = `lea-${run}@lists.test`;
let familyId;

async function api(request, method, path, data) {
  const response = await request.fetch(`/api${path}`, {
    method,
    headers: { 'x-dev-email': email, ...(familyId ? { 'x-family': String(familyId) } : {}) },
    data,
  });
  expect(response.ok(), `${method} ${path} : ${response.status()}`).toBeTruthy();
  return response.json();
}

test.beforeAll(async ({ request }) => {
  await api(request, 'PUT', '/me', { name: 'Léa', likes: 'Lecture' });
  familyId = (await api(request, 'POST', '/families', { name: 'Famille Listes' })).family.id;
  await api(request, 'POST', '/wishes', { title: 'Vélo', price: '300 €', favorite: true });
  await api(request, 'POST', '/wishes', { title: 'Écharpe', price: '25 €', note: 'laine' });
  await api(request, 'POST', '/wishes', { title: 'Livre de cuisine' });
});

const open = (page) => page.goto(`/?as=${encodeURIComponent(email)}#/moi`);
const titles = (page) => page.locator('.wish .wish-title').allTextContents();

test('tri par prix et recherche sur Ma liste', async ({ page }) => {
  await open(page);
  await page.locator('.wish').first().waitFor();
  await page.getByLabel('Trier par').selectOption('price-up');
  expect(await titles(page)).toEqual(['Écharpe', 'Vélo', 'Livre de cuisine']);

  await page.getByLabel('Rechercher dans ma liste').fill('echarpe');
  expect(await titles(page)).toEqual(['Écharpe']);
  await expect(page.locator('.count').first()).toHaveText('1 sur 3');

  await page.getByLabel('Rechercher dans ma liste').fill('zzz');
  await expect(page.getByText('Aucune envie ne correspond.')).toBeVisible();
});

test('filtre sur les coups de cœur', async ({ page }) => {
  await open(page);
  await page.locator('.wish').first().waitFor();
  await page.getByRole('button', { name: 'Coups de cœur' }).click();
  expect(await titles(page)).toEqual(['Vélo']);
});

test('cadeau reçu ajouté à la main, puis corrigé', async ({ page }) => {
  await open(page);
  await page.locator('.wish').first().waitFor();
  await page.getByText('Cadeaux reçus').click();
  await page.getByRole('button', { name: 'Ajouter un cadeau reçu' }).click();

  await page.getByLabel('Quoi').fill('Pull en laine');
  await page.getByLabel(/De la part de/).fill('Mamie');
  await page.getByLabel('Reçu le').fill('2025-12-25');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();

  const gift = page.locator('.archive-item', { hasText: 'Pull en laine' });
  await expect(gift).toContainText('De la part de Mamie');
  await expect(gift).toContainText('25 décembre 2025');
  // Il n'est pas dans la liste d'envies visible par la famille.
  expect(await titles(page)).not.toContain('Pull en laine');

  await gift.getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel(/De la part de/).fill('Papi');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.archive-item', { hasText: 'Pull en laine' })).toContainText('De la part de Papi');
});
