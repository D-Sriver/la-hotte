// « Vérifier en boutique » : une idée de l'IA est-elle retrouvée chez un vendeur ?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { matchingResults } from '../server/pricesearch.js';
import { saveIdea, ideaHistory } from '../server/ideas.js';
import { cleanIdea } from '../server/ai.js';
import { onRequestPost as verify } from '../functions/api/ideas/[id]/verify.js';

const shopping = (results) => async () => new Response(JSON.stringify({ shopping_results: results }));
const withFetch = async (fake, run) => {
  const real = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    return await run();
  } finally {
    globalThis.fetch = real;
  }
};

test('seuls les résultats qui reprennent la recherche comptent', () => {
  const results = [
    { title: 'Tour PC gamer RGB' },
    { title: 'Nendoroid Hatsune Miku figurine 10 cm' },
    { title: 'Nendoroid Hatsune Miku Symphony' },
  ];
  assert.deepEqual(
    matchingResults(results, 'Nendoroid Hatsune Miku').map((r) => r.title),
    ['Nendoroid Hatsune Miku figurine 10 cm', 'Nendoroid Hatsune Miku Symphony'],
  );
  assert.deepEqual(matchingResults(results, ''), []);
});

test('une idée avec « certain » le garde, sinon elle est à vérifier', () => {
  assert.equal(cleanIdea({ title: 'Nendoroid Miku', certain: true }).certain, 1);
  assert.equal(cleanIdea({ title: 'Une figurine', certain: false }).certain, 0);
  assert.equal(cleanIdea({ title: 'Une figurine' }).certain, 0);
});

async function setup() {
  const db = testDb();
  const s = seed(db);
  const me = s.user('Mia');
  const family = s.family('F', me);
  const idea = await saveIdea(
    db,
    { personId: me, viewerId: me, familyId: family },
    {
      title: 'Nendoroid Hatsune Miku',
      why: '',
      price: '≈ 35 €',
      shop: '',
      search_url: 'https://www.google.com/search?q=Nendoroid%20Hatsune%20Miku%20acheter',
      certain: 1,
    },
  );
  return { db, me, family, idea };
}

test('trouvée en boutique : prix et lien gardés, et une seule recherche par idée', async () => {
  const { db, me, family, idea } = await setup();
  let calls = 0;
  const env = { SERPAPI_KEY: 'k' };
  const fake = async (url) => {
    calls++;
    assert.match(String(url), /q=Nendoroid\+Hatsune\+Miku(&|$)/, 'la requête n’a pas « acheter »');
    return shopping([
      { title: 'Nendoroid Hatsune Miku', extracted_price: 39.9, source: 'Fnac', link: 'https://fnac.test/miku' },
    ])();
  };
  await withFetch(fake, async () => {
    const first = await call(verify, { db, me, family, params: { id: String(idea.id) }, env, body: {} });
    assert.equal(first.status, 200);
    assert.equal(first.body.verified, 1);
    assert.equal(first.body.found_shop, 'Fnac');
    assert.match(first.body.found_price, /39,9/);
    await call(verify, { db, me, family, params: { id: String(idea.id) }, env, body: {} });
  });
  assert.equal(calls, 1, 'le résultat est gardé, pas de deuxième recherche');
  const [saved] = await ideaHistory(db, me, me, family);
  assert.equal(saved.verified, 1);
  assert.equal(saved.certain, true);
});

test('introuvable : l’idée est marquée, sans prix inventé', async () => {
  const { db, me, family, idea } = await setup();
  await withFetch(shopping([{ title: 'Tour PC gamer', extracted_price: 900, source: 'LDLC' }]), async () => {
    const result = await call(verify, {
      db,
      me,
      family,
      params: { id: String(idea.id) },
      env: { SERPAPI_KEY: 'k' },
      body: {},
    });
    assert.equal(result.body.verified, 0);
    assert.equal(result.body.found_price, null);
  });
});

test('sans clé SerpApi, ou idée d’un autre : refus clair, rien d’enregistré', async () => {
  const { db, me, family, idea } = await setup();
  const none = await call(verify, { db, me, family, params: { id: String(idea.id) }, env: {}, body: {} });
  assert.equal(none.status, 503);
  const other = seed(db).user('Zoe');
  const stranger = await call(verify, {
    db,
    me: other,
    family,
    params: { id: String(idea.id) },
    env: { SERPAPI_KEY: 'k' },
    body: {},
  });
  assert.equal(stranger.status, 404);
  const [saved] = await ideaHistory(db, me, me, family);
  assert.equal(saved.verified, null);
});
