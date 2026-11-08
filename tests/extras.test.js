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
