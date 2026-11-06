import { json, fail, readJson, clean } from '../../../server/http.js';
import { visibleWishes, personInFamily } from '../../../server/wishes.js';
import { findIdeas } from '../../../server/ai.js';
import { ideaHistory, saveIdea } from '../../../server/ideas.js';

// Les idées déjà proposées pour une personne (GET /api/ideas?person_id=12).
export async function onRequestGet({ request, env, data }) {
  const personId = Number(new URL(request.url).searchParams.get('person_id'));
  const person = await personInFamily(env.DB, personId, data.family.id);
  if (!person) return fail(404, 'Personne introuvable.');
  return json({ ideas: await ideaHistory(env.DB, person.id, data.me.id, data.family.id) });
}

/**
 * Lance une recherche. La réponse arrive ligne par ligne (une ligne JSON par événement) :
 * { idea } pour chaque idée dès qu'elle est prête, puis { done, remaining } ou { error }.
 */
export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const person = await personInFamily(env.DB, Number(body?.person_id), data.family.id);
  if (!person) return fail(404, 'Personne introuvable.');

  // Deux limites : par personne, et par famille (pour qu'une famille ne vide pas le quota des autres).
  const limit = Number(env.IDEAS_PER_DAY || 20);
  const familyLimit = Number(env.FAMILY_IDEAS_PER_DAY || 40);
  const { used, family_used: familyUsed } = await env.DB.prepare(
    `SELECT SUM(user_id = ?1) AS used, SUM(family_id = ?2) AS family_used
     FROM idea_requests WHERE created_at > datetime('now', '-1 day')`,
  )
    .bind(data.me.id, data.family.id)
    .first();
  if (used >= limit) return fail(429, `Limite de ${limit} recherches par jour atteinte. Reviens demain.`);
  if (familyUsed >= familyLimit) return fail(429, `Ta famille a fait ses ${familyLimit} recherches du jour. Reviens demain.`);
  if (!env.AI) return fail(500, 'Workers AI n’est pas branché sur le projet (binding AI).');

  await env.DB.prepare('INSERT INTO idea_requests (user_id, family_id) VALUES (?1, ?2)').bind(data.me.id, data.family.id).run();

  const owner = { personId: person.id, viewerId: data.me.id, familyId: data.family.id };
  const wishes = await visibleWishes(env.DB, person.id, data.me.id, data.family.id);
  const history = await ideaHistory(env.DB, person.id, data.me.id, data.family.id);
  // Ses cadeaux déjà reçus : envoyés seulement au modèle, pour ne pas les reproposer.
  const { results: received } = await env.DB.prepare(
    `SELECT title FROM wishes WHERE owner_id = ?1 AND received_at > datetime('now', '-2 years')
     ORDER BY received_at DESC LIMIT 20`,
  )
    .bind(person.id)
    .all();
  const input = {
    person,
    wishes,
    received: received.map((r) => r.title),
    history,
    budget: clean(body.budget, 60),
    occasion: body.occasion === 'birthday' ? 'birthday' : 'christmas',
    note: clean(body.note, 300),
    forSelf: person.id === data.me.id,
  };

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (event) => writer.write(encoder.encode(`${JSON.stringify(event)}\n`));

  (async () => {
    try {
      const count = await findIdeas(env, input, async (idea) => send({ idea: await saveIdea(env.DB, owner, idea) }));
      await send(count
        ? { done: true, remaining: Math.min(limit - used, familyLimit - familyUsed) - 1 }
        : { error: 'Aucune idée exploitable cette fois. Relance la recherche.' });
    } catch (err) {
      console.error(err);
      await send({ error: 'La recherche a échoué. Réessaie dans une minute.' }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
