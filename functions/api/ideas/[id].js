import { json, fail, readJson } from '../../../server/http.js';
import { visibleIdea } from '../../../server/ideas.js';

// Avis sur une idée de l'IA : { rating: 1 | -1 | null } et/ou { kept: true }.
export async function onRequestPut({ request, env, data, params }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const idea = await visibleIdea(env.DB, Number(params.id), data.me.id, data.family.id);
  if (!idea) return fail(404, 'Idée introuvable.');

  const rating = 'rating' in body ? ([1, -1].includes(body.rating) ? body.rating : null) : idea.rating;
  const kept = body.kept === true ? 1 : idea.kept;
  await env.DB.prepare('UPDATE ai_ideas SET rating = ?1, kept = ?2 WHERE id = ?3').bind(rating, kept, idea.id).run();
  return json({ id: idea.id, rating, kept: !!kept });
}
