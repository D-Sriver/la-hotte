// Sauvegarde, journal d'erreurs, suivi des prix, récap de Noël, liste partagée.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { logError } from '../server/errors.js';
import { structuredPrice } from '../server/preview.js';
import { isNewDrop, watchPrices } from '../server/pricewatch.js';
import { christmasRecap, recapYear } from '../server/christmas.js';
import { backupDatabase } from '../server/backup.js';
import { sharedList, sharedPhoto } from '../server/share.js';
import { remindersFor } from '../reminders/index.js';
import { onRequestGet as reservations } from '../functions/api/reservations.js';
import { onRequestPost as share } from '../functions/api/me/share.js';
import { onRequestGet as publicList } from '../functions/liste/[[path]].js';
import { onRequestPost as reserve } from '../functions/api/wishes/[id]/reserve.js';

let db, s, alice, bob, carol, f1;
beforeEach(() => {
  db = testDb();
  s = seed(db);
  [alice, bob, carol] = ['Alice', 'Bob', 'Carol'].map((n) => s.user(n));
  f1 = s.family('Un', alice, bob, carol);
});
const setUrl = (wish, url) => db.sqlite.prepare('UPDATE wishes SET url = ? WHERE id = ?').run(url, wish);

test('journal d’erreurs : plafonné par personne et par heure', async () => {
  for (let i = 0; i < 25; i++) await logError(db, { source: 'client', userId: alice, message: `boum ${i}` });
  await logError(db, { source: 'server', userId: bob, message: 'x'.repeat(2000) });
  const rows = db.sqlite.prepare('SELECT user_id, length(message) AS len FROM error_log').all();
  assert.equal(rows.filter((r) => r.user_id === alice).length, 20);
  assert.equal(rows.find((r) => r.user_id === bob).len, 500);
});

test('prix structuré : JSON-LD, meta, milliers, autre devise refusée', () => {
  const ld = (offer) =>
    `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'X', offers: offer })}</script>`;
  assert.equal(structuredPrice(ld({ price: '49.90', priceCurrency: 'EUR' })), 49.9);
  assert.equal(structuredPrice(ld({ price: '1.299,99', priceCurrency: 'EUR' })), 1299.99);
  assert.equal(structuredPrice(ld({ price: '20', priceCurrency: 'USD' })), null);
  assert.equal(structuredPrice('<meta property="product:price:amount" content="12,50">'), 12.5);
  assert.equal(structuredPrice('<p>Prix : 30 €</p>'), null); // pas de données structurées : pas suivi
});

test('baisse de prix : au moins 1 € et 5 %, une seule alerte par nouveau plus bas', () => {
  assert.equal(isNewDrop({ first: 100, price: 96, alerted: null }), false);
  assert.equal(isNewDrop({ first: 100, price: 90, alerted: null }), true);
  assert.equal(isNewDrop({ first: 100, price: 90, alerted: 90 }), false);
  assert.equal(isNewDrop({ first: 100, price: 85, alerted: 90 }), true);
  assert.equal(isNewDrop({ first: 10, price: 9.4, alerted: null }), false); // 6 % mais moins d'1 €
});

test('suivi des prix : seulement réservé, pas acheté, avec lien ; alerte à celui qui achète', async () => {
  const lego = s.wish(alice, 'Lego', { reservedBy: bob });
  const free = s.wish(alice, 'Livre');
  const blocked = s.wish(carol, 'Casque', { reservedBy: bob });
  setUrl(lego, 'https://shop.test/lego');
  setUrl(free, 'https://shop.test/livre');
  setUrl(blocked, 'https://shop.test/casque');
  const prices = { 'https://shop.test/lego': 100, 'https://shop.test/casque': null };
  const fetchPrice = async (url) => prices[url];

  assert.deepEqual(await watchPrices({ DB: db }, { fetchPrice }), { checked: 2, alerts: 0 });
  prices['https://shop.test/lego'] = 80;
  assert.deepEqual(await watchPrices({ DB: db }, { fetchPrice }), { checked: 2, alerts: 1 });
  assert.deepEqual(await watchPrices({ DB: db }, { fetchPrice }), { checked: 2, alerts: 0 }); // déjà signalé

  const { body } = await call(reservations, { db, me: bob, family: f1 });
  const byTitle = Object.fromEntries(body.gifts.map((g) => [g.title, g.price_watch]));
  assert.deepEqual(byTitle.Lego, { tracked: true, first: 100, last: 80, drop: true });
  assert.equal(byTitle.Casque.tracked, false);

  // Réservation libérée : le suivi repart de zéro pour le prochain.
  await call(reserve, {
    db,
    me: { id: bob, name: 'Bob' },
    family: f1,
    params: { id: lego },
    body: { action: 'reserve' },
  });
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM price_watch WHERE wish_id = ?').get(lego).n, 0);
});

test('récap de Noël : révélé du 26 décembre au 31 janvier, cadeaux offerts seulement', async () => {
  const y = 2026;
  assert.equal(recapYear(new Date(Date.UTC(y, 11, 25))), null);
  assert.equal(recapYear(new Date(Date.UTC(y, 11, 26))), y);
  assert.equal(recapYear(new Date(Date.UTC(y + 1, 0, 31))), y);
  assert.equal(recapYear(new Date(Date.UTC(y + 1, 1, 1))), null);

  s.wish(alice, 'Vélo', { reservedBy: bob, receivedAt: `${y}-12-24 20:00:00` });
  const pot = s.wish(alice, 'Console', { reservedBy: carol, group: true, receivedAt: `${y}-12-27 10:00:00` });
  s.contribute(pot, carol);
  s.contribute(pot, bob);
  s.wish(alice, 'Surprise', { addedBy: bob, family: f1, reservedBy: bob, receivedAt: `${y}-12-25 09:00:00` });
  s.wish(alice, 'Pour son anniversaire', { reservedBy: bob }); // pas encore offert : reste secret
  s.wish(alice, 'Acheté elle-même', { receivedAt: `${y}-12-20 09:00:00` }); // personne ne l'a réservé

  assert.equal(await christmasRecap(db, alice, new Date(Date.UTC(y, 11, 20))), null);
  const recap = await christmasRecap(db, alice, new Date(Date.UTC(y, 11, 28)));
  assert.equal(recap.year, y);
  assert.deepEqual(
    recap.gifts.map((g) => [g.title, g.from, g.secret]),
    [
      ['Vélo', 'Bob', false],
      ['Surprise', 'Bob', true],
      ['Console', 'Carol et Bob', false],
    ],
  );
});

test('26 décembre : rappel de marquer « Offert » ce qui a été donné', async () => {
  s.wish(alice, 'Vélo', { reservedBy: bob });
  const { lines } = await remindersFor(db, { id: bob }, new Date(Date.UTC(2026, 11, 26, 8)));
  assert.ok(lines.some((l) => l.includes('Noël est passé')));
  const { lines: carolLines } = await remindersFor(db, { id: carol }, new Date(Date.UTC(2026, 11, 26, 8)));
  assert.ok(!carolLines.some((l) => l.includes('Noël est passé')));
});

test('sauvegarde : toutes les tables dans KV, gardée 30 jours', async () => {
  s.wish(alice, 'Vélo', { reservedBy: bob });
  const stored = {};
  const BACKUPS = { put: async (key, value, options) => (stored[key] = { value, options }) };
  const result = await backupDatabase({ DB: db, BACKUPS }, new Date(Date.UTC(2026, 11, 24, 3)));
  assert.equal(result.key, 'backup-2026-12-24');
  const dump = JSON.parse(stored['backup-2026-12-24'].value);
  assert.equal(dump.tables.users.length, 3);
  assert.equal(dump.tables.wishes[0].title, 'Vélo');
  assert.equal(stored['backup-2026-12-24'].options.expirationTtl, 30 * 86400);
  assert.equal(await backupDatabase({ DB: db }), null); // pas de KV branché : rien
});

test('liste partagée : ses envies seulement, sans réservation ni idée secrète, lien révocable', async () => {
  s.wish(alice, 'Vélo', { reservedBy: bob });
  s.wish(alice, 'Idée de Bob', { addedBy: bob, family: f1 });
  s.wish(alice, 'Déjà reçu', { receivedAt: '2026-01-01 10:00:00' });
  const secretPhotoWish = s.wish(alice, 'Secret avec photo', { addedBy: bob, family: f1 });
  const photo = Number(
    db.sqlite
      .prepare("INSERT INTO wish_photos (wish_id, photo) VALUES (?, 'data:image/jpeg;base64,AAAA')")
      .run(secretPhotoWish).lastInsertRowid,
  );

  const { body } = await call(share, { db, me: alice, body: { enabled: true } });
  const token = body.share_token;
  assert.match(token, /^[A-Za-z0-9_-]{22}$/);

  const list = await sharedList(db, token);
  assert.deepEqual(
    list.wishes.map((w) => w.title),
    ['Vélo'],
  );
  assert.ok(!('reserved_by' in list.wishes[0]));
  assert.equal(await sharedPhoto(db, token, photo), null); // la photo d'une idée secrète ne sort pas

  const html = await (await publicList({ env: { DB: db }, params: { path: [token] } })).text();
  assert.ok(html.includes('La liste de Alice') && html.includes('Vélo'));
  assert.ok(!html.includes('Bob')); // ni qui réserve, ni ses idées secrètes

  await call(share, { db, me: alice, body: { enabled: false } });
  assert.equal(await sharedList(db, token), null);
  const gone = await publicList({ env: { DB: db }, params: { path: [token] } });
  assert.equal(gone.status, 404);
});

test('occasion : la fête la plus proche par défaut, modifiable par celui qui achète, invisible pour la personne gâtée', async () => {
  const { defaultOccasion } = await import('../server/occasion.js');
  const nov = new Date(Date.UTC(2026, 10, 8));
  assert.equal(defaultOccasion('1990-11-20', nov), 'birthday');
  assert.equal(defaultOccasion('1990-12-30', nov), 'christmas');
  assert.equal(defaultOccasion(null, nov), 'christmas');

  const velo = s.wish(alice, 'Vélo');
  await call(reserve, {
    db,
    me: { id: bob, name: 'Bob' },
    family: f1,
    params: { id: velo },
    body: { action: 'reserve' },
  });
  assert.equal(db.sqlite.prepare('SELECT occasion FROM wishes WHERE id = ?').get(velo).occasion, 'christmas');
  const carolTries = await call(reserve, {
    db,
    me: { id: carol, name: 'Carol' },
    family: f1,
    params: { id: velo },
    body: { action: 'occasion', occasion: 'birthday' },
  });
  assert.equal(carolTries.status, 403);
  await call(reserve, {
    db,
    me: { id: bob, name: 'Bob' },
    family: f1,
    params: { id: velo },
    body: { action: 'occasion', occasion: 'birthday' },
  });
  const { visibleWishes } = await import('../server/wishes.js');
  assert.equal((await visibleWishes(db, alice, bob, f1))[0].occasion, 'birthday');
  assert.ok(!('occasion' in (await visibleWishes(db, alice, alice, f1))[0]));

  // Offert pour son anniversaire : n'apparaît pas dans le récap de Noël.
  db.sqlite.prepare("UPDATE wishes SET received_at = '2026-12-24 10:00:00' WHERE id = ?").run(velo);
  assert.deepEqual((await christmasRecap(db, alice, new Date(Date.UTC(2026, 11, 28)))).gifts, []);
});

test('merci : seulement la personne gâtée, une fois, visible de ceux qui ont offert', async () => {
  const { onRequestPost: thanks } = await import('../functions/api/wishes/[id]/thanks.js');
  const velo = s.wish(alice, 'Vélo', { reservedBy: bob, receivedAt: '2026-12-25 10:00:00' });
  const notGiven = s.wish(alice, 'Livre', { reservedBy: bob });
  const ctx = (me, id) => ({ db, me: { id: me, name: me === alice ? 'Alice' : 'Bob' }, family: f1, params: { id } });
  assert.equal((await call(thanks, ctx(bob, velo))).status, 404);
  assert.equal((await call(thanks, ctx(alice, notGiven))).status, 404);
  assert.equal((await call(thanks, ctx(alice, velo))).body.ok, true);
  assert.equal((await call(thanks, ctx(alice, velo))).body.already, true);
  const { body } = await call(reservations, { db, me: bob, family: f1 });
  assert.equal(body.given.find((g) => g.title === 'Vélo').thanked, true);
});

test('suivi des prix : Google Shopping une fois par semaine quand la boutique bloque, deux par matin', async () => {
  const titles = ['A', 'B', 'C'];
  for (const t of titles) setUrl(s.wish(alice, t, { reservedBy: bob }), `https://blocked.test/${t}`);
  let searches = 0;
  const searchShopping = async () => (searches++, 50);
  const env = { DB: db, SERPAPI_KEY: 'x' };
  const now = new Date(Date.UTC(2026, 10, 10, 7));
  await watchPrices(env, { fetchPrice: async () => null, searchShopping, now });
  assert.equal(searches, 2); // deux par matin au plus
  await watchPrices(env, { fetchPrice: async () => null, searchShopping, now });
  assert.equal(searches, 3); // le troisième, pas les deux déjà cherchés cette semaine
  const rows = db.sqlite.prepare('SELECT source, last_price FROM price_watch').all();
  assert.ok(rows.every((r) => r.source === 'shopping' && r.last_price === 50));
  // La page redevient lisible : nouvelle source, on repart de son prix (pas de fausse baisse).
  const res = await watchPrices(env, { fetchPrice: async () => 30, searchShopping, now });
  assert.equal(res.alerts, 0);
});

test('prévenir : par email quand la personne n’a pas les notifications (si l’envoi est configuré)', async () => {
  const { deliver } = await import('../server/deliver.js');
  const message = { title: 'Prix en baisse', body: '« Vélo » : 80 €', url: '/#/cadeaux' };
  assert.equal(await deliver({ DB: db }, bob, message), 0); // ni notifications ni emails : rien
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => (sent.push({ url, body: JSON.parse(init.body) }), new Response('{}'));
  try {
    const env = {
      DB: db,
      RESEND_API_KEY: 'k',
      EMAIL_FROM: 'La Hotte <hotte@exemple.fr>',
      APP_URL: 'https://hotte.test',
    };
    assert.equal(await deliver(env, bob, message), 1);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(sent[0].body.to[0], 'bob@test.fr');
  assert.match(sent[0].body.text, /https:\/\/hotte\.test\/#\/cadeaux/);
});

test('agenda : les anniversaires de ses familles, en iCalendar, lien révocable', async () => {
  const { onRequestPost: calendar } = await import('../functions/api/me/calendar.js');
  db.sqlite.prepare("UPDATE users SET birthday = '1990-03-14' WHERE id = ?").run(bob);
  db.sqlite.prepare("UPDATE users SET birthday = '1985-12-02' WHERE id = ?").run(alice);
  const { body } = await call(calendar, { db, me: alice, body: { enabled: true } });
  const token = body.calendar_token;
  const res = await publicList({ env: { DB: db }, params: { path: ['agenda', `${token}.ics`] } });
  assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
  const ics = await res.text();
  assert.match(ics, /SUMMARY:Anniversaire de Bob/);
  assert.match(ics, /DTSTART;VALUE=DATE:\d{4}0314/);
  assert.match(ics, /RRULE:FREQ=YEARLY/);
  assert.ok(!ics.includes('Alice')); // pas son propre anniversaire
  assert.ok(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75));
  await call(calendar, { db, me: alice, body: { enabled: false } });
  const gone = await publicList({ env: { DB: db }, params: { path: ['agenda', `${token}.ics`] } });
  assert.equal(gone.status, 404);
});
