// La règle d'or : on ne découvre jamais ses propres cadeaux.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { visibleWishes, personInFamily, wishInFamily } from '../server/wishes.js';
import { onRequestGet as getPerson } from '../functions/api/people/[id].js';
import { onRequestGet as getPeople } from '../functions/api/people/index.js';

let db, s, alice, bob, carol, dave, f1, f2, own, received, secretF1, pot;

// Famille 1 : Alice, Bob, Carol. Famille 2 : Alice, Dave.
beforeEach(() => {
  db = testDb();
  s = seed(db);
  [alice, bob, carol, dave] = ['Alice', 'Bob', 'Carol', 'Dave'].map((n) => s.user(n));
  f1 = s.family('Un', alice, bob, carol);
  f2 = s.family('Deux', alice, dave);
  own = s.wish(alice, 'Vélo', { price: '300 €', reservedBy: bob });
  received = s.wish(alice, 'Écharpe', { receivedAt: '2026-01-02 10:00:00' });
  secretF1 = s.wish(alice, 'Surprise de Bob', { addedBy: bob, family: f1 });
  s.wish(alice, 'Surprise de Dave', { addedBy: dave, family: f2 });
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

test('cadeau à plusieurs : seul l’organisateur coche « acheté » ou « offert »', async () => {
  const { onRequestPost: gift } = await import('../functions/api/wishes/[id]/reserve.js');
  s = seed(db);
  s.contribute(pot, carol, 50);
  const act = (me, action) => call(gift, { db, me, family: f1, params: { id: String(pot) }, body: { action } });
  assert.equal((await act(carol, 'bought')).status, 403);
  assert.equal((await act(carol, 'given')).status, 403);
  assert.equal((await act(bob, 'bought')).status, 200);
});

test('invitation : on voit les prénoms des membres avant de rejoindre', async () => {
  const { onRequestGet: invitation } = await import('../functions/api/join.js');
  const eve = await db.prepare('SELECT * FROM users WHERE id = ?1').bind(s.user('Eve')).first();
  db.sqlite.prepare("UPDATE families SET code = 'K7PQ-M3XA' WHERE id = ?").run(f1);
  const { body } = await call(invitation, { db, me: eve, family: null, url: 'https://test/api/join?code=k7pq m3xa' });
  assert.deepEqual(body.family.members.sort(), ['Alice', 'Bob', 'Carol']);
  assert.equal(body.member, false);
});

test('supprimer une envie déjà réservée : elle quitte sa liste, mais celui qui l’offre la garde', async () => {
  const { onRequestDelete: remove, onRequestPut: change } = await import('../functions/api/wishes/[id].js');
  const { onRequestPost: gift } = await import('../functions/api/wishes/[id]/reserve.js');
  const free = s.wish(alice, 'Livre');

  assert.equal((await call(remove, { db, me: alice, family: f1, params: { id: String(own) } })).status, 200);
  assert.equal((await call(remove, { db, me: alice, family: f1, params: { id: String(free) } })).status, 200);
  assert.equal(db.sqlite.prepare('SELECT 1 FROM wishes WHERE id = ?').get(free), undefined, 'libre : vraiment supprimée');

  assert.equal((await visibleWishes(db, alice, alice, f1)).some((w) => w.id === own), false, 'Alice ne la voit plus');
  const bobView = (await visibleWishes(db, alice, bob, f1)).find((w) => w.id === own);
  assert.equal(bobView.removed, true, 'Bob la garde, avec l’avertissement');
  assert.equal((await visibleWishes(db, alice, carol, f1)).some((w) => w.id === own), false, 'les autres ne la voient plus');
  assert.equal((await call(change, { db, me: alice, family: f1, params: { id: String(own) }, body: { title: 'x' } })).status, 404);

  // Bob annule : plus personne n'en a besoin, elle disparaît pour de bon.
  await call(gift, { db, me: bob, family: f1, params: { id: String(own) }, body: { action: 'reserve' } });
  assert.equal(db.sqlite.prepare('SELECT 1 FROM wishes WHERE id = ?').get(own), undefined);
});

test('modifier une envie après sa réservation prévient celui qui l’offre', async () => {
  const { onRequestPut: change } = await import('../functions/api/wishes/[id].js');
  db.sqlite.prepare("UPDATE wishes SET reserved_at = datetime('now', '-1 hour') WHERE id = ?").run(own);
  assert.equal((await visibleWishes(db, alice, bob, f1)).find((w) => w.id === own).edited_after_reservation, false);
  await call(change, { db, me: alice, family: f1, params: { id: String(own) }, body: { title: 'Vélo électrique', price: '300 €' } });
  assert.equal((await visibleWishes(db, alice, bob, f1)).find((w) => w.id === own).edited_after_reservation, true);
});

test('notifications : jamais la personne gâtée, seulement la famille affichée, et pas ceux qui ont dit non', async () => {
  const { recipients } = await import('../server/notify.js');
  db.sqlite.prepare('UPDATE users SET notify_messages = 0 WHERE id = ?').run(carol);
  const to = await recipients(db, { userIds: [alice, bob, carol, dave, bob], familyId: f1, ownerId: alice, senderId: null, kind: 'messages' });
  assert.deepEqual(to, [bob]);
  const groups = await recipients(db, { userIds: [alice, bob, carol, dave], familyId: f1, ownerId: alice, senderId: null, kind: 'groups' });
  assert.deepEqual(groups.sort(), [bob, carol].sort(), 'Carol a coupé les messages, pas les cagnottes');
});

test('préférences de notification : chaque interrupteur ne change que le sien', async () => {
  const { onRequestPut: prefs } = await import('../functions/api/me/notifications.js');
  const put = (body) => call(prefs, { db, me: bob, family: f1, body });
  assert.deepEqual((await put({ messages: false })).body, { reminders: true, messages: false, groups: true });
  assert.deepEqual((await put({ reminders: false, groups: false })).body, { reminders: false, messages: false, groups: false });
  assert.equal((await put({ messages: 'oui' })).status, 400);
});
