import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeWishes, priceNumber } from '../src/listTools.js';

const wishes = [
  { id: 1, title: 'Vélo', price: '300 €', favorite: true, created_at: '2025-01-01 10:00:00' },
  { id: 2, title: 'Écharpe', price: '≈ 25,90 €', favorite: false, created_at: '2025-03-01 10:00:00', note: 'laine' },
  { id: 3, title: 'Livre', price: '', favorite: false, created_at: '2025-02-01 10:00:00' },
  { id: 4, title: 'Casque', price: '120', favorite: false, created_at: '2025-04-01 10:00:00' },
];
const ids = (list) => list.map((w) => w.id);

test('le premier nombre du prix est lu, virgule comprise', () => {
  assert.equal(priceNumber('≈ 25,90 €'), 25.9);
  assert.equal(priceNumber('20-40 €'), 20);
  assert.equal(priceNumber('1 200 €'), 1200);
  assert.equal(priceNumber('gratuit'), null);
});

test('l’ordre du serveur est gardé par défaut', () => {
  assert.deepEqual(ids(arrangeWishes(wishes)), [1, 2, 3, 4]);
});

test('tri par date, par prix (sans prix en dernier) et A → Z', () => {
  assert.deepEqual(ids(arrangeWishes(wishes, { sort: 'recent' })), [4, 2, 3, 1]);
  assert.deepEqual(ids(arrangeWishes(wishes, { sort: 'old' })), [1, 3, 2, 4]);
  assert.deepEqual(ids(arrangeWishes(wishes, { sort: 'price-up' })), [2, 4, 1, 3]);
  assert.deepEqual(ids(arrangeWishes(wishes, { sort: 'price-down' })), [1, 4, 2, 3]);
  assert.deepEqual(ids(arrangeWishes(wishes, { sort: 'az' })), [4, 2, 3, 1]);
});

test('filtre : coups de cœur, et recherche sans tenir compte des accents ni des majuscules', () => {
  assert.deepEqual(ids(arrangeWishes(wishes, { onlyFavorites: true })), [1]);
  assert.deepEqual(ids(arrangeWishes(wishes, { query: 'echarpe' })), [2]);
  assert.deepEqual(ids(arrangeWishes(wishes, { query: 'LAINE' })), [2], 'la note compte aussi');
  assert.deepEqual(ids(arrangeWishes(wishes, { query: 'zzz' })), []);
});

test('l’original n’est pas modifié par le tri', () => {
  const before = ids(wishes);
  arrangeWishes(wishes, { sort: 'az' });
  assert.deepEqual(ids(wishes), before);
});
