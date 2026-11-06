// Le parcours de Gérard : ce qu'on tape au doigt doit passer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { cleanUrl } from '../server/http.js';
import { onRequestPut as saveMe } from '../functions/api/me.js';

test('un lien tapé à la main est accepté, le reste est ignoré sans bloquer', () => {
  assert.equal(cleanUrl('amazon.fr/canne-a-peche'), 'https://amazon.fr/canne-a-peche');
  assert.equal(cleanUrl('https://www.lego.com/fr-fr'), 'https://www.lego.com/fr-fr');
  assert.equal(cleanUrl('amazon'), null);
  assert.equal(cleanUrl('une canne à pêche'), null);
  assert.equal(cleanUrl('javascript:alert(1)'), null);
});

test('un prénom tapé en minuscules prend ses majuscules, le reste n’est pas touché', async () => {
  const db = testDb();
  const me = seed(db).user('x');
  const name = async (typed) => (await call(saveMe, { db, me, family: null, body: { name: typed } })).body.me.name;
  assert.equal(await name('gerard'), 'Gerard');
  assert.equal(await name('jean-pierre'), 'Jean-Pierre');
  assert.equal(await name('élodie'), 'Élodie');
  assert.equal(await name('McDonald'), 'McDonald');
});
