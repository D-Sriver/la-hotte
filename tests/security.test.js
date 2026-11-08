// Une page piégée sur un autre site ne doit rien pouvoir écrire, même si le navigateur envoie le cookie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/_middleware.js';

const URL_ = 'https://la-hotte.pages.dev/api/wishes/1/reserve';
const run = async (init) => {
  let reached = false;
  const response = await onRequest({
    request: new Request(URL_, init),
    env: { DEV_MODE: '1', DEV_EMAIL: null, DB: null },
    data: {},
    next: async () => {
      reached = true;
      return new Response('ok');
    },
  });
  return { status: response.status, reached };
};

test('écriture venant d’un autre site : refusée avant toute chose', async () => {
  const fromElsewhere = await run({
    method: 'POST',
    headers: { origin: 'https://site-malveillant.example', 'content-type': 'application/json' },
    body: '{"action":"reserve"}',
  });
  assert.deepEqual(fromElsewhere, { status: 403, reached: false });

  const crossSite = await run({ method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}' });
  assert.equal(crossSite.status, 403);
});

test('formulaire text/plain (le seul qu’un autre site peut envoyer sans demander) : refusé', async () => {
  const form = await run({ method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"action":"reserve"}' });
  assert.deepEqual(form, { status: 403, reached: false });
});

test('les lectures et les écritures de La Hotte passent le contrôle', async () => {
  // Le contrôle passé, la suite demande d'être connecté : 401 ici (pas d'utilisateur de test), pas 403.
  const read = await run({ method: 'GET', headers: { origin: 'https://site-malveillant.example' } });
  assert.notEqual(read.status, 403);
  const own = await run({
    method: 'POST',
    headers: { origin: 'https://la-hotte.pages.dev', 'content-type': 'application/json; charset=utf-8' },
    body: '{}',
  });
  assert.notEqual(own.status, 403);
});
