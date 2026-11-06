import { json, fail, readJson, clean, cleanUrl } from '../../../server/http.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const ownerId = Number(body.owner_id) || data.me.id;
  const title = clean(body.title, 200);
  if (!title) return fail(400, 'Donne un nom à l’idée.');

  const owner = await env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(ownerId).first();
  if (!owner) return fail(404, 'Personne introuvable.');

  const wish = await env.DB.prepare(
    `INSERT INTO wishes (owner_id, added_by, title, url, price, note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id`,
  )
    .bind(ownerId, data.me.id, title, cleanUrl(body.url), clean(body.price, 40), clean(body.note, 500))
    .first();
  return json({ id: wish.id }, 201);
}
