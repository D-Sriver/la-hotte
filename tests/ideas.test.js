import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { testDb, seed, call } from './helpers.js';
import { ideaReader, findIdeas } from '../server/ai.js';
import { ideaHistory, saveIdea, visibleIdea } from '../server/ideas.js';
import { onRequestPost as search, onRequestGet as history } from '../functions/api/ideas/index.js';
import { onRequestPut as rate } from '../functions/api/ideas/[id].js';

const IDEAS = [
  {
    title: 'Moulin à café manuel',
    why: 'Elle aime le café',
    price: '≈ 45 €',
    where: 'torréfacteur',
    search: 'moulin café manuel',
  },
  { title: 'Atelier « latte art »', why: 'Pour aller plus loin', price: '≈ 60 €' },
  { title: 'Café de spécialité', why: 'À partager', price: '≈ 20 €' },
];

// Faux Workers AI : renvoie la réponse en flux, découpée en petits morceaux, comme le vrai.
function fakeAi(text, { stream = true } = {}) {
  const calls = [];
  return {
    calls,
    async run(model, input) {
      calls.push(input);
      if (!input.stream || !stream) return { response: text };
      const pieces = text.match(/[\s\S]{1,7}/g);
      return new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          for (const piece of pieces)
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: piece })}\n\n`));
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
    },
  };
}

test('le lecteur rend chaque idée dès que son objet est fermé', () => {
  const reader = ideaReader();
  const text = `Voici :\n${JSON.stringify(IDEAS)}`;
  const seen = [];
  for (const char of text) {
    seen.push(...reader.push(char));
  }
  assert.deepEqual(
    seen.map((i) => i.title),
    IDEAS.map((i) => i.title),
  );
  assert.deepEqual(reader.finish(), [], 'rien en double à la fin');
});

test('le lecteur ignore la réflexion, les accolades dans le texte et les doublons', () => {
  const reader = ideaReader();
  const ideas = [
    ...reader.push('<think>Je pense à [ceci] et {cela}</think>'),
    ...reader.push(
      '[{"title": "Livre « {Dune} »", "why": "il a dit \\"génial\\""}, {"title": "livre « {dune} »"}, {"oops"}, {"title": "Puzzle"}]',
    ),
    ...reader.finish(),
  ];
  assert.deepEqual(
    ideas.map((i) => i.title),
    ['Livre « {Dune} »', 'Puzzle'],
  );
  assert.equal(ideas[0].why, 'il a dit "génial"');
});

test('le lecteur fabrique un lien de recherche et coupe les textes trop longs', () => {
  const [idea] = ideaReader().push(JSON.stringify([{ title: 'x'.repeat(500), search: 'jeu de société' }]));
  assert.equal(idea.title.length, 200);
  assert.equal(idea.search_url, 'https://www.google.com/search?tbm=shop&q=jeu%20de%20soci%C3%A9t%C3%A9');
});

test('findIdeas lit le flux, et retombe sur une réponse classique si le flux est vide', async () => {
  const input = { person: { name: 'Alice' }, wishes: [], received: [] };
  const got = [];
  assert.equal(await findIdeas({ AI: fakeAi(JSON.stringify(IDEAS)) }, input, (i) => got.push(i.title)), 3);
  assert.deepEqual(
    got,
    IDEAS.map((i) => i.title),
  );

  const silent = fakeAi(JSON.stringify(IDEAS));
  silent.run = async (model, args) => {
    silent.calls.push(args);
    return args.stream ? new ReadableStream({ start: (c) => c.close() }) : { response: JSON.stringify(IDEAS) };
  };
  const again = [];
  assert.equal(await findIdeas({ AI: silent }, input, (i) => again.push(i)), 3);
  assert.deepEqual(
    silent.calls.map((c) => c.stream),
    [true, false],
  );
});

test('findIdeas transmet à l’IA les avis sur les idées précédentes', async () => {
  const ai = fakeAi('[]');
  await findIdeas(
    { AI: ai },
    {
      person: { name: 'Alice' },
      wishes: [],
      received: ['Écharpe'],
      history: [
        { title: 'Moulin', rating: 1, kept: false },
        { title: 'Bougie', rating: -1, kept: false },
        { title: 'Puzzle', rating: null, kept: true },
        { title: 'Plaid', rating: null, kept: false },
      ],
    },
    () => {},
  );
  const prompt = ai.calls[0].messages[1].content;
  assert.match(prompt, /qui ont plu[^\n]*Moulin ; Puzzle/);
  assert.match(prompt, /jugées à côté[^\n]*Bougie/);
  assert.match(prompt, /Idées déjà proposées \(ne pas reproposer\) : Plaid/);
  assert.match(prompt, /déjà reçus[^\n]*Écharpe/);
});

test('findIdeas tutoie la personne quand elle cherche pour elle-même', async () => {
  const prompt = async (forSelf) => {
    const ai = fakeAi('[]');
    await findIdeas({ AI: ai }, { person: { name: 'Alice' }, wishes: [], received: [], forSelf }, () => {});
    return ai.calls[0].messages[1].content;
  };
  assert.match(await prompt(true), /en la tutoyant/);
  assert.match(await prompt(false), /par son prénom/);
});

let db, alice, bob, dave, f1, f2;
beforeEach(() => {
  db = testDb();
  const s = seed(db);
  [alice, bob, dave] = ['Alice', 'Bob', 'Dave'].map((n) => s.user(n));
  f1 = s.family('Un', alice, bob);
  f2 = s.family('Deux', alice, dave);
});

const idea = { title: 'Moulin', why: '', price: '', shop: '', search_url: null };

test('historique : on ne voit jamais les idées cherchées pour soi par les autres', async () => {
  const forAlice = await saveIdea(db, { personId: alice, viewerId: bob, familyId: f1 }, idea);
  const mine = await saveIdea(db, { personId: alice, viewerId: alice, familyId: f1 }, { ...idea, title: 'Pour moi' });

  assert.deepEqual(
    (await ideaHistory(db, alice, alice, f1)).map((i) => i.title),
    ['Pour moi'],
  );
  assert.deepEqual(
    (await ideaHistory(db, alice, bob, f1)).map((i) => i.title),
    ['Moulin'],
  );
  assert.deepEqual(await ideaHistory(db, alice, dave, f2), [], 'une autre famille ne voit rien');

  assert.equal(await visibleIdea(db, forAlice.id, alice, f1), null);
  assert.equal(await visibleIdea(db, forAlice.id, dave, f2), null);
  assert.ok(await visibleIdea(db, forAlice.id, bob, f1));
  assert.equal(await visibleIdea(db, mine.id, bob, f1), null);
});

test('route POST /api/ideas : les idées arrivent en flux et sont enregistrées', async () => {
  const env = { AI: fakeAi(JSON.stringify(IDEAS)) };
  const { status, body } = await call(search, { db, me: bob, family: f1, env, body: { person_id: alice } });
  assert.equal(status, 200);
  const events = body
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    events.filter((e) => e.idea).map((e) => e.idea.title),
    IDEAS.map((i) => i.title),
  );
  assert.ok(
    events.every((e) => !e.idea || e.idea.id),
    'chaque idée a son numéro pour l’avis',
  );
  assert.equal(events.at(-1).done, true);

  const saved = await call(history, { db, me: bob, family: f1, url: `https://test/api/ideas?person_id=${alice}` });
  assert.equal(saved.body.ideas.length, 3);
  const aliceSees = await call(history, {
    db,
    me: alice,
    family: f1,
    url: `https://test/api/ideas?person_id=${alice}`,
  });
  assert.deepEqual(aliceSees.body.ideas, []);
});

test('route POST /api/ideas : une recherche ratée renvoie une erreur lisible', async () => {
  const env = { AI: fakeAi('Désolé, je ne peux pas.') };
  const { body } = await call(search, { db, me: bob, family: f1, env, body: { person_id: alice } });
  assert.match(JSON.parse(body.trim().split('\n').at(-1)).error, /Aucune idée/);
});

test('route PUT /api/ideas/:id : avis enregistré, et refusé à la personne gâtée', async () => {
  const saved = await saveIdea(db, { personId: alice, viewerId: bob, familyId: f1 }, idea);
  const put = (me, family, body) => call(rate, { db, me, family, params: { id: String(saved.id) }, body });

  assert.equal((await put(alice, f1, { rating: 1 })).status, 404);
  assert.deepEqual((await put(bob, f1, { rating: -1 })).body, { id: saved.id, rating: -1, kept: false });
  assert.deepEqual((await put(bob, f1, { kept: true })).body, { id: saved.id, rating: -1, kept: true });
  assert.deepEqual((await put(bob, f1, { rating: 'n’importe quoi' })).body, { id: saved.id, rating: null, kept: true });
});
