// La règle d'or : on ne découvre jamais ses propres cadeaux.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { visibleWishes, personInFamily, wishInFamily } from '../server/wishes.js';
import { onRequestGet as getPerson } from '../functions/api/people/[id].js';
import { onRequestGet as getPeople } from '../functions/api/people/index.js';

let db, alice, bob, carol, dave, f1, f2, own, received, secretF1, secretF2, pot;

// Famille 1 : Alice, Bob, Carol. Famille 2 : Alice, Dave.
beforeEach(() => {
  db = testDb();
  const s = seed(db);
  [alice, bob, carol, dave] = ['Alice', 'Bob', 'Carol', 'Dave'].map((n) => s.user(n));
  f1 = s.family('Un', alice, bob, carol);
  f2 = s.family('Deux', alice, dave);
  own = s.wish(alice, 'Vélo', { price: '300 €', reservedBy: bob });
  received = s.wish(alice, 'Écharpe', { receivedAt: '2026-01-02 10:00:00' });
  secretF1 = s.wish(alice, 'Surprise de Bob', { addedBy: bob, family: f1 });
  secretF2 = s.wish(alice, 'Surprise de Dave', { addedBy: dave, family: f2 });
  pot = s.wish(alice, 'Appareil photo', { price: '400 €', group: true, reservedBy: bob });
  s.contribute(pot, bob, 100);
});

const titles = (wishes) => wishes.map((w) => w.title).sort();

test('pour soi : ses envies seulement, sans idée secrète ni réservation', async () => {
  const wishes = await visibleWishes(db, alice, alice, f1);
  assert.deepEqual(titles(wishes), ['Appareil photo', 'Vélo']);
  for (const wish of wishes) {
    for (const key of ['reserved', 'reserved_by_name', 'participants', 'bought', 'collected', 'secret', 'added_by_name', 'message_count']) {
      assert.equal(key in wish, false, `${key} ne doit pas être envoyé à la personne gâtée`);
    }
  }
});

test('pour soi : même réponse quelle que soit la famille affichée', async () => {
  assert.deepEqual(titles(await visibleWishes(db, alice, alice, f2)), ['Appareil photo', 'Vélo']);
});

test('un proche voit les idées secrètes de sa famille, pas celles d’une autre', async () => {
  assert.deepEqual(titles(await visibleWishes(db, alice, carol, f1)), ['Appareil photo', 'Surprise de Bob', 'Vélo']);
  assert.deepEqual(titles(await visibleWishes(db, alice, dave, f2)), ['Appareil photo', 'Surprise de Dave', 'Vélo']);
});

test('une réservation se voit partout, mais le nom seulement dans la même famille', async () => {
  const carolView = (await visibleWishes(db, alice, carol, f1)).find((w) => w.id === own);
  assert.equal(carolView.reserved, true);
  assert.equal(carolView.reserved_by_name, 'Bob');

  const daveView = (await visibleWishes(db, alice, dave, f2)).find((w) => w.id === own);
  assert.equal(daveView.reserved, true);
  assert.notEqual(daveView.reserved_by_name, 'Bob');

  const daveAndPot = (await visibleWishes(db, alice, dave, f2)).find((w) => w.id === pot);
  assert.deepEqual(daveAndPot.participants.map((p) => p.name), ['Autre famille']);
  assert.equal(daveAndPot.collected, 100);
});

test('un cadeau reçu quitte les listes et ne reste que dans les archives de son propriétaire', async () => {
  assert.equal((await visibleWishes(db, alice, carol, f1)).some((w) => w.id === received), false);
  assert.equal((await visibleWishes(db, alice, alice, f1)).some((w) => w.id === received), false);
  assert.deepEqual(titles(await visibleWishes(db, alice, alice, f1, { archived: true })), ['Écharpe']);
});

test('on ne voit que les membres de la famille affichée', async () => {
  assert.ok(await personInFamily(db, alice, f2));
  assert.equal(await personInFamily(db, dave, f1), null);
  assert.equal(await personInFamily(db, bob, f2), null);
});

test('on ne peut agir sur une idée secrète que depuis sa famille', async () => {
  assert.ok(await wishInFamily(db, secretF1, f1));
  assert.equal(await wishInFamily(db, secretF1, f2), null);
  assert.ok(await wishInFamily(db, own, f2));
});

test('route /api/people/:id : la personne gâtée ne reçoit aucune info cachée', async () => {
  const { status, body } = await call(getPerson, { db, me: alice, family: f1, params: { id: String(alice) } });
  assert.equal(status, 200);
  const text = JSON.stringify(body);
  for (const leak of ['Surprise', 'Bob', 'reserved', 'participants']) assert.equal(text.includes(leak), false, leak);
});

test('route /api/people/:id : quelqu’un d’une autre famille reçoit une 404', async () => {
  const { status } = await call(getPerson, { db, me: dave, family: f2, params: { id: String(bob) } });
  assert.equal(status, 404);
});

test('route /api/people : le compteur d’envies ne trahit pas les idées secrètes', async () => {
  const { body } = await call(getPeople, { db, me: alice, family: f1 });
  assert.equal(body.people.find((p) => p.id === alice).wish_count, 2);
  const carolSees = await call(getPeople, { db, me: carol, family: f1 });
  assert.equal(carolSees.body.people.find((p) => p.id === alice).wish_count, 3);
});
