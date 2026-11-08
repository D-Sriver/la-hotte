// Accessibilité : axe-core (WCAG 2.1 AA) sur chaque écran, en clair et en sombre, menus ouverts compris,
// plus le parcours principal au clavier seul. Ne remplace pas un vrai passage au lecteur d'écran,
// mais attrape les contrastes, noms manquants, rôles ARIA incorrects et pièges au clavier.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';

// Adresses propres à chaque lancement : un worker relancé après un échec repart d'une famille neuve.
const run = Date.now().toString(36);
const people = { zoe: `zoe-${run}@a11y.test`, yan: `yan-${run}@a11y.test`, xav: `xav-${run}@a11y.test` };
const ids = {};
let familyId;
let shareLink;

async function as(request, who, method, path, body) {
  const response = await request.fetch(`/api${path}`, {
    method,
    headers: { 'x-dev-email': people[who], ...(familyId ? { 'x-family': String(familyId) } : {}) },
    data: body,
  });
  expect(response.ok(), `${method} ${path} : ${response.status()}`).toBeTruthy();
  return response.json();
}
const open = (page, who, hash = '') => page.goto(`/?as=${encodeURIComponent(people[who])}#/${hash}`);

test.beforeAll(async ({ request }) => {
  for (const [who, name] of [
    ['zoe', 'Zoé'],
    ['yan', 'Yan'],
    ['xav', 'Xavier'],
  ])
    ids[who] = (await as(request, who, 'PUT', '/me', { name, likes: 'Lecture, randonnée' })).me.id;
  const { family } = await as(request, 'zoe', 'POST', '/families', { name: 'Famille A11y' });
  familyId = family.id;
  await as(request, 'yan', 'POST', '/join', { code: family.code });
  await as(request, 'xav', 'POST', '/join', { code: family.code });
  const velo = await as(request, 'zoe', 'POST', '/wishes', { title: 'Vélo', price: '300 €', favorite: true });
  const livre = await as(request, 'zoe', 'POST', '/wishes', { title: 'Livre de cuisine', price: '25 €' });
  await as(request, 'zoe', 'POST', '/wishes', { title: 'Casque', price: '120 €', url: 'https://example.com/casque' });
  await as(request, 'yan', 'POST', '/wishes', { owner_id: ids.zoe, title: 'Idée secrète', price: '40 €' });
  await as(request, 'yan', 'POST', `/wishes/${velo.id}/reserve`, { action: 'reserve' });
  await as(request, 'yan', 'POST', `/wishes/${velo.id}/reserve`, { action: 'bought' });
  await as(request, 'xav', 'POST', `/wishes/${livre.id}/reserve`, { action: 'group' });
  await as(request, 'yan', 'POST', `/wishes/${livre.id}/reserve`, { action: 'join', amount: 10 });
  shareLink = `/liste/${(await as(request, 'zoe', 'POST', '/me/share', { enabled: true })).share_token}`;
});

async function audit(page, label) {
  // Les animations d'entrée finies, pour juger les couleurs réelles.
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map(
    (v) =>
      `${label} · ${v.id} (${v.impact}) : ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(' ')}`).join('\n')}`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

for (const scheme of ['light', 'dark']) {
  test.describe(`thème ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('accueil, ma liste, ce que j’offre, profil', async ({ page }) => {
      await open(page, 'yan');
      await page.getByRole('heading', { name: /Qui on gâte/ }).waitFor();
      await audit(page, `${scheme} accueil`);
      await open(page, 'zoe', 'moi');
      await page.getByText('Livre de cuisine').waitFor();
      await audit(page, `${scheme} ma liste`);
      await open(page, 'yan', 'cadeaux');
      await page.getByText('Vélo').first().waitFor();
      await audit(page, `${scheme} ce que j’offre`);
      await open(page, 'yan', 'profil');
      await page.getByLabel(/Prénom/).waitFor();
      await audit(page, `${scheme} profil`);
    });

    test('page d’une personne, menu « Gérer » et discussion ouverts', async ({ page }) => {
      await open(page, 'yan', `p/${ids.zoe}`);
      const velo = page.locator('.wish', { hasText: 'Vélo' });
      await velo.waitFor();
      await audit(page, `${scheme} personne`);
      await velo.getByRole('button', { name: /^Gérer/ }).click();
      await audit(page, `${scheme} menu Gérer`);
      await page.keyboard.press('Escape');
      await velo.getByRole('button', { name: /Discuter en secret/ }).click();
      await audit(page, `${scheme} discussion`);
    });

    test('liste partagée publique', async ({ page }) => {
      await page.goto(shareLink);
      await audit(page, `${scheme} liste partagée`);
    });
  });
}

test('au clavier seul : réserver, puis annuler depuis « Gérer »', async ({ page }) => {
  await open(page, 'xav', `p/${ids.zoe}`);
  const casque = page.locator('.wish', { hasText: 'Casque' });
  const reserve = casque.getByRole('button', { name: 'Je réserve' });
  await reserve.waitFor();
  // On avance à la tabulation jusqu'au bouton, comme quelqu'un sans souris.
  for (let i = 0; i < 80 && !(await reserve.evaluate((el) => el === el.ownerDocument.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(reserve).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(casque.getByText('C’est toi qui l’offres')).toBeVisible();

  const more = casque.getByRole('button', { name: /^Gérer/ });
  await more.focus();
  await page.keyboard.press('Enter');
  const cancel = casque.getByRole('menuitem', { name: 'Annuler ma réservation' });
  for (let i = 0; i < 6 && !(await cancel.evaluate((el) => el === el.ownerDocument.activeElement)); i++)
    await page.keyboard.press('ArrowDown');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(casque.getByRole('button', { name: 'Je réserve' })).toBeVisible();
});

test('QR code d’invitation et tableau de bord de l’administrateur', async ({ page }) => {
  await open(page, 'zoe');
  await page.getByRole('button', { name: 'Montrer le QR code de l’invitation' }).click();
  await page.getByRole('dialog').waitFor();
  await audit(page, 'QR code');

  // Zoé devient administratrice dans la base locale des tests.
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'la-hotte',
      '--local',
      '--persist-to',
      '.wrangler/e2e',
      '--command',
      `UPDATE users SET is_admin = 1 WHERE email = '${people.zoe}'`,
    ],
    { stdio: 'ignore' },
  );
  await open(page, 'zoe', 'admin');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Famille A11y' })).toBeVisible();
  await audit(page, 'tableau de bord');
});
