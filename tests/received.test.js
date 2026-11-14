// Cadeaux reçus saisis à la main : entrent directement dans les archives, avec de qui et quand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { cleanDay } from '../server/http.js';
import { visibleWishes } from '../server/wishes.js';
import { onRequestPost as addWish } from '../functions/api/wishes/index.js';
import { onRequestPut as editWish } from '../functions/api/wishes/[id].js';

test('un jour tapé devient une date de base, un faux jour est refusé', () => {
  assert.equal(cleanDay('2025-12-24'), '2025-12-24 12:00:00');
  assert.equal(cleanDay('2025-02-30'), null);
  assert.equal(cleanDay('24/12/2025'), null);
  assert.equal(cleanDay(undefined), null);
});

test('un cadeau reçu ajouté à la main va dans les archives, pas dans la liste', async () => {
  const db = testDb();
  const s = seed(db);
  const me = s.user('Mia');
  const family = s.family('F', me);

  const added = await call(addWish, {
    db,
    me,
    family,
    body: { title: 'Écharpe', received: true, received_from: 'Mamie', received_on: '2025-12-24' },
  });
  assert.equal(added.status, 201);

  const list = await visibleWishes(db, me, me, family);
  const archived = await visibleWishes(db, me, me, family, { archived: true });
  assert.equal(list.length, 0);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].received_from, 'Mamie');
  assert.equal(archived[0].received_at, '2025-12-24 12:00:00');
});

test('un cadeau reçu se corrige : de qui et quand', async () => {
  const db = testDb();
  const s = seed(db);
  const me = s.user('Mia');
  const family = s.family('F', me);
  const { body } = await call(addWish, { db, me, family, body: { title: 'Écharpe', received: true } });

  const saved = await call(editWish, {
    db,
    me,
    family,
    params: { id: String(body.id) },
    body: { title: 'Écharpe en laine', received_from: 'Papi', received_on: '2025-12-25' },
  });
  assert.equal(saved.status, 200);

  const [gift] = await visibleWishes(db, me, me, family, { archived: true });
  assert.equal(gift.title, 'Écharpe en laine');
  assert.equal(gift.received_from, 'Papi');
  assert.equal(gift.received_at, '2025-12-25 12:00:00');
});

test('une envie ordinaire ne prend ni date de réception ni expéditeur', async () => {
  const db = testDb();
  const s = seed(db);
  const me = s.user('Mia');
  const family = s.family('F', me);
  const { body } = await call(addWish, {
    db,
    me,
    family,
    body: { title: 'Sécateur', received_from: 'Mamie', received_on: '2025-12-24' },
  });
  const row = await db.prepare('SELECT received_at, received_from FROM wishes WHERE id = ?1').bind(body.id).first();
  assert.deepEqual(row, { received_at: null, received_from: null });
});
