import { json, fail, readJson, clean } from '../../server/http.js';
import { visibleWishes, personInFamily } from '../../server/wishes.js';
import { findIdeas } from '../../server/ai.js';

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

  const wishes = await visibleWishes(env.DB, person.id, data.me.id, data.family.id);
  // Ses cadeaux déjà reçus : envoyés seulement au modèle, pour ne pas les reproposer.
  const { results: received } = await env.DB.prepare(
    `SELECT title FROM wishes WHERE owner_id = ?1 AND received_at > datetime('now', '-2 years')
     ORDER BY received_at DESC LIMIT 20`,
  )
    .bind(person.id)
    .all();
  try {
    const ideas = await findIdeas(env, {
      person,
      wishes,
      received: received.map((r) => r.title),
      budget: clean(body.budget, 60),
      occasion: body.occasion === 'birthday' ? 'birthday' : 'christmas',
      note: clean(body.note, 300),
    });
    if (!ideas.length) return fail(502, 'Aucune idée exploitable cette fois. Relance la recherche.');
    return json({ ideas, remaining: Math.min(limit - used, familyLimit - familyUsed) - 1 });
  } catch (err) {
    console.error(err);
    return fail(502, 'La recherche a échoué. Réessaie dans une minute.');
  }
}
