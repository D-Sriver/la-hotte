import { json, fail, readJson, clean } from '../../../server/http.js';

const mine = (data, id) => data.families.find((f) => f.id === Number(id));

// Renommer : n'importe quel membre.
export async function onRequestPut({ request, env, data, params }) {
  const family = mine(data, params.id);
  if (!family) return fail(404, 'Famille introuvable.');
  const name = clean((await readJson(request))?.name, 60);
  if (!name) return fail(400, 'Donne un nom à ta famille.');
  await env.DB.prepare('UPDATE families SET name = ?1 WHERE id = ?2').bind(name, family.id).run();
  return json({ ok: true });
}

// Quitter la famille. Le dernier qui part l'efface, avec ses idées secrètes.
export async function onRequestDelete({ env, data, params }) {
  const family = mine(data, params.id);
  if (!family) return fail(404, 'Famille introuvable.');
  await env.DB.prepare('DELETE FROM memberships WHERE family_id = ?1 AND user_id = ?2')
    .bind(family.id, data.me.id)
    .run();
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM memberships WHERE family_id = ?1')
    .bind(family.id)
    .first();
  if (!left.n) await env.DB.prepare('DELETE FROM families WHERE id = ?1').bind(family.id).run();
  return json({ ok: true });
}
