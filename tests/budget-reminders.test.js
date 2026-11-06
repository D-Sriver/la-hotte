import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { onRequestGet as reservations } from '../functions/api/reservations.js';
import { remindersFor } from '../reminders/index.js';

let db, s, alice, bob, carol, dave, f1;
beforeEach(() => {
  db = testDb();
  s = seed(db);
  [alice, bob, carol, dave] = ['Alice', 'Bob', 'Carol', 'Dave'].map((n) => s.user(n));
  f1 = s.family('Un', alice, bob, carol, dave);
});

const thisYear = new Date().getUTCFullYear();

test('budget : prévu, déjà offert cette année, et rien des années passées', async () => {
  s.wish(alice, 'Vélo', { price: '300 €', reservedBy: bob });
  const pot = s.wish(carol, 'Appareil photo', { price: '400 €', group: true, reservedBy: dave });
  s.contribute(pot, dave, 150);
  s.contribute(pot, bob, null); // part non précisée : part égale (400 / 2)
  s.wish(alice, 'Écharpe', { price: '25 €', reservedBy: bob, receivedAt: `${thisYear}-01-03 10:00:00` });
  s.wish(alice, 'Vieux cadeau', { price: '80 €', reservedBy: bob, receivedAt: `${thisYear - 1}-12-25 10:00:00` });

  const { body } = await call(reservations, { db, me: bob, family: f1 });
  assert.deepEqual(body.gifts.map((g) => g.title).sort(), ['Appareil photo', 'Vélo']);
  assert.deepEqual(body.given.map((g) => g.title), ['Écharpe']);
  assert.equal(body.total, 500);
  assert.equal(body.year_total, 525);
});

// Le 18 décembre : Noël dans 7 jours.
const dec18 = new Date(Date.UTC(thisYear, 11, 18, 8));

test('rappel de Noël : personne n’a rien prévu, moi non plus, listes vides', async () => {
  s.wish(bob, 'Chaussettes'); // Bob a une envie, et l'a remplie
  s.wish(carol, 'Livre', { reservedBy: dave }); // Carol : quelqu'un d'autre a prévu
  // Dave : liste vide, personne n'a rien prévu. Alice (moi) : liste vide.
  const { lines, keys } = await remindersFor(db, { id: alice }, dec18);
  assert.deepEqual(lines, [
    'Noël dans 7 jours et ta liste est vide : ajoute quelques envies pour aider ta famille.',
    'Noël dans 7 jours : personne n’a encore rien prévu pour Bob et Dave.',
    'Noël dans 7 jours : tu n’as encore rien prévu pour Carol.',
    'La liste de Dave est vide : une idée secrète ou l’IA peuvent t’aider.',
  ]);
  assert.deepEqual(keys, [`xmas-${thisYear}-7`]);
});

test('rappel de Noël : rien à dire quand tout est prévu, et jamais deux fois', async () => {
  s.wish(alice, 'Pull');
  for (const person of [bob, carol, dave]) s.wish(person, 'Envie', { reservedBy: alice });
  assert.deepEqual((await remindersFor(db, { id: alice }, dec18)).lines, []);

  db.sqlite.prepare('DELETE FROM wishes WHERE owner_id = ?').run(dave);
  db.sqlite.prepare('INSERT INTO reminders_sent (user_id, key) VALUES (?, ?)').run(alice, `xmas-${thisYear}-7`);
  assert.deepEqual((await remindersFor(db, { id: alice }, dec18)).lines, []);
});

test('rappel de Noël : pas en dehors des jours prévus', async () => {
  const dec19 = new Date(Date.UTC(thisYear, 11, 19, 8));
  assert.deepEqual((await remindersFor(db, { id: alice }, dec19)).lines, []);
});
