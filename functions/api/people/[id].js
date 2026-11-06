import { json, fail } from '../../../server/http.js';
import { visibleWishes } from '../../../server/wishes.js';

export async function onRequestGet({ env, data, params }) {
  const id = Number(params.id);
  const person = await env.DB.prepare(
    'SELECT id, name, likes, dislikes, owns, sizes, budget_hint FROM users WHERE id = ?1 AND name IS NOT NULL',
  )
    .bind(id)
    .first();
  if (!person) return fail(404, 'Personne introuvable.');
  const wishes = await visibleWishes(env.DB, person.id, data.me.id);
  return json({ person: { ...person, is_me: person.id === data.me.id }, wishes });
}
