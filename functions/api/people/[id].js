import { json, fail } from '../../../server/http.js';
import { visibleWishes, personInFamily } from '../../../server/wishes.js';

export async function onRequestGet({ env, data, params }) {
  const person = await personInFamily(env.DB, Number(params.id), data.family.id);
  if (!person) return fail(404, 'Personne introuvable dans cette famille.');
  const wishes = await visibleWishes(env.DB, person.id, data.me.id, data.family.id);
  return json({ person: { ...person, is_me: person.id === data.me.id }, wishes });
}
