import { json, fail, readJson, clean } from '../../server/http.js';
import { visibleWishes } from '../../server/wishes.js';
import { findIdeas } from '../../server/ai.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const person = await env.DB.prepare(
    'SELECT id, name, likes, dislikes, owns, sizes, budget_hint FROM users WHERE id = ?1 AND name IS NOT NULL',
  )
    .bind(Number(body?.person_id))
    .first();
  if (!person) return fail(404, 'Personne introuvable.');

  const limit = Number(env.IDEAS_PER_DAY || 20);
  const { used } = await env.DB.prepare(
    "SELECT COUNT(*) AS used FROM idea_requests WHERE user_id = ?1 AND created_at > datetime('now', '-1 day')",
  )
    .bind(data.me.id)
    .first();
  if (used >= limit) return fail(429, `Limite de ${limit} recherches par jour atteinte. Reviens demain.`);
  if (!env.AI) return fail(500, 'Workers AI n’est pas branché sur le projet (binding AI).');

  await env.DB.prepare('INSERT INTO idea_requests (user_id) VALUES (?1)').bind(data.me.id).run();

  const wishes = await visibleWishes(env.DB, person.id, data.me.id);
  try {
    const ideas = await findIdeas(env, {
      person,
      wishes,
      budget: clean(body.budget, 60),
      note: clean(body.note, 300),
    });
    if (!ideas.length) return fail(502, 'Aucune idée exploitable cette fois. Relance la recherche.');
    return json({ ideas, remaining: limit - used - 1 });
  } catch (err) {
    console.error(err);
    return fail(502, 'La recherche a échoué. Réessaie dans une minute.');
  }
}
