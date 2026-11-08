// Parcours de la famille dans un vrai navigateur : réserver, cagnotte, secret gardé, partage hors famille.
// Chaque personne est jouée avec ?as=email (connexion de dev, serveur local uniquement).
import { test, expect } from '@playwright/test';

const people = { alice: 'alice@e2e.test', bob: 'bob@e2e.test', carol: 'carol@e2e.test' };
const ids = {};
let familyId;

// La famille est créée par l'API (plus rapide que l'écran d'accueil, testé à part plus bas).
async function as(request, who, method, path, body) {
  const response = await request.fetch(`/api${path}`, {
    method,
    headers: { 'x-dev-email': people[who], ...(familyId ? { 'x-family': String(familyId) } : {}) },
    data: body,
  });
  expect(response.ok(), `${method} ${path} pour ${who} : ${response.status()}`).toBeTruthy();
  return response.json();
}

const open = (page, who, hash = '') => page.goto(`/?as=${encodeURIComponent(people[who])}#/${hash}`);

test.beforeAll(async ({ request }) => {
  for (const [who, name] of [
    ['alice', 'Alice'],
    ['bob', 'Bob'],
    ['carol', 'Carol'],
  ])
    ids[who] = (await as(request, who, 'PUT', '/me', { name })).me.id;
  const { family } = await as(request, 'alice', 'POST', '/families', { name: 'Famille Test' });
  familyId = family.id;
  await as(request, 'bob', 'POST', '/join', { code: family.code });
  await as(request, 'carol', 'POST', '/join', { code: family.code });
  await as(request, 'alice', 'POST', '/wishes', { title: 'Vélo rouge', price: '300 €' });
  await as(request, 'alice', 'POST', '/wishes', { title: 'Appareil photo', price: '400 €' });
});

test('Bob réserve le vélo : Carol le voit, Alice non', async ({ browser }) => {
  const bob = await browser.newPage();
  await open(bob, 'bob', `p/${ids.alice}`);
  const velo = bob.locator('.wish', { hasText: 'Vélo rouge' });
  await velo.getByRole('button', { name: 'Je réserve' }).click();
  await expect(velo.getByText('C’est toi qui l’offres')).toBeVisible();

  const carol = await browser.newPage();
  await open(carol, 'carol', `p/${ids.alice}`);
  await expect(carol.locator('.wish', { hasText: 'Vélo rouge' }).getByText('Réservé par Bob')).toBeVisible();

  const alice = await browser.newPage();
  await open(alice, 'alice', 'moi');
  await expect(alice.getByText('Vélo rouge')).toBeVisible();
  await expect(alice.getByText(/Réservé|Bob/)).toHaveCount(0);
});

test('Carol lance une cagnotte, Bob participe, Alice ne voit rien', async ({ browser }) => {
  const carol = await browser.newPage();
  await open(carol, 'carol', `p/${ids.alice}`);
  const photo = carol.locator('.wish', { hasText: 'Appareil photo' });
  await photo.getByRole('button', { name: 'Offrir à plusieurs' }).click();
  await photo.getByRole('button', { name: 'Oui, lancer la cagnotte' }).click();
  await expect(photo.getByText('Cagnotte', { exact: true })).toBeVisible();

  const bob = await browser.newPage();
  await open(bob, 'bob', `p/${ids.alice}`);
  await bob.locator('.wish', { hasText: 'Appareil photo' }).getByRole('button', { name: 'Je participe' }).click();
  await expect(
    bob.locator('.wish', { hasText: 'Appareil photo' }).getByRole('button', { name: 'Je me retire' }),
  ).toBeVisible();

  const alice = await browser.newPage();
  await open(alice, 'alice', 'moi');
  await expect(alice.getByText('Appareil photo')).toBeVisible();
  await expect(alice.getByText(/Cagnotte|Carol|Bob/)).toHaveCount(0);
});

test('« Ce que j’offre » : Bob voit son vélo et le marque acheté', async ({ page }) => {
  await open(page, 'bob', 'cadeaux');
  const velo = page.locator('.wish', { hasText: 'Vélo rouge' });
  await velo.getByRole('button', { name: 'Marquer acheté' }).click();
  await expect(velo.getByRole('button', { name: 'Acheté' })).toBeVisible();
  await expect(velo.getByRole('button', { name: 'Offert' })).toBeVisible();
});

test('Alice partage sa liste hors de la famille, sans les réservations', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, 'alice', 'moi');
  await page.getByRole('button', { name: 'Créer un lien de partage' }).click();
  const link = (await page.locator('.share-link').textContent()).trim();
  expect(link).toMatch(/\/liste\/[A-Za-z0-9_-]{22}$/);

  // Un inconnu, sans compte : il voit les envies, rien sur qui offre quoi.
  const stranger = await (await page.context().browser().newContext()).newPage();
  await stranger.goto(link);
  await expect(stranger.getByRole('heading', { name: 'La liste de Alice' })).toBeVisible();
  await expect(stranger.getByText('Vélo rouge')).toBeVisible();
  await expect(stranger.getByText(/Bob|Carol|Réservé|Cagnotte/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Couper le lien' }).click();
  await expect(page.getByRole('button', { name: 'Créer un lien de partage' })).toBeVisible();
  expect((await stranger.goto(link)).status()).toBe(404);
});

test('premier passage : Dave crée sa famille, donne son prénom et arrive sur l’accueil', async ({ page }) => {
  await page.goto('/?as=dave@e2e.test#/');
  await page.getByRole('tab', { name: 'Créer ma famille' }).click();
  await page.getByLabel(/Nom de la famille/).fill('Famille Dave');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.getByLabel(/Prénom/).fill('dave');
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page.getByRole('heading', { name: /Qui on gâte/ })).toBeVisible();
  await expect(page.getByText(/Dave/).first()).toBeVisible(); // « dave » a pris sa majuscule
});
