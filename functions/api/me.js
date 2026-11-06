import { json, fail, readJson, clean } from '../../server/http.js';
import { visibleWishes } from '../../server/wishes.js';

const publicProfile = (u) => ({
  id: u.id, email: u.email, name: u.name, likes: u.likes, dislikes: u.dislikes,
  owns: u.owns, sizes: u.sizes, budget_hint: u.budget_hint,
});

export async function onRequestGet({ env, data }) {
  const families = data.families;
  const me = { ...publicProfile(data.me), families, family: data.family };
  if (!data.family) return json({ me, wishes: [] });
  const wishes = await visibleWishes(env.DB, data.me.id, data.me.id, data.family.id);
  return json({ me, wishes });
}

export async function onRequestPut({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const name = clean(body.name, 60);
  if (!name) return fail(400, 'Ajoute ton prénom.');

  const me = await env.DB.prepare(
    `UPDATE users SET name = ?1, likes = ?2, dislikes = ?3, owns = ?4, sizes = ?5,
       budget_hint = ?6, updated_at = datetime('now')
     WHERE id = ?7 RETURNING *`,
  )
    .bind(name, clean(body.likes), clean(body.dislikes), clean(body.owns), clean(body.sizes, 300),
      clean(body.budget_hint, 60), data.me.id)
    .first();
  return json({ me: { ...publicProfile(me), families: data.families, family: data.family } });
}
