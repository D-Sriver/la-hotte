import { json, fail, readJson, clean, cleanUrl, cleanPhoto } from '../../../server/http.js';

// Modifier : seulement ce qu'on a ajouté soi-même.
export async function onRequestPut({ request, env, data, params }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const wish = await env.DB.prepare('SELECT id, owner_id, added_by FROM wishes WHERE id = ?1')
    .bind(Number(params.id))
    .first();
  if (!wish || wish.added_by !== data.me.id) return fail(404, 'Tu ne peux modifier que ce que tu as ajouté.');

  const title = clean(body.title, 200);
  if (!title) return fail(400, 'Donne un nom à l’idée.');
  // photo : absente = on garde, '' = on retire, data URL = on remplace.
  let photoSql = 'photo';
  let photo = null;
  if (body.photo === '') photoSql = 'NULL';
  else if (body.photo !== undefined) {
    photo = cleanPhoto(body.photo);
    if (!photo) return fail(400, 'Photo trop lourde ou illisible.');
    photoSql = '?6';
  }
  // Le coup de cœur n'a de sens que sur sa propre liste.
  const favorite = wish.owner_id === data.me.id && body.favorite ? 1 : 0;

  await env.DB.prepare(
    `UPDATE wishes SET title = ?1, url = ?2, price = ?3, note = ?4, favorite = ?5, photo = ${photoSql}
     WHERE id = ?7`,
  )
    .bind(title, cleanUrl(body.url), clean(body.price, 40), clean(body.note, 500), favorite, photo, wish.id)
    .run();
  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const result = await env.DB.prepare('DELETE FROM wishes WHERE id = ?1 AND added_by = ?2')
    .bind(Number(params.id), data.me.id)
    .run();
  if (!result.meta.changes) return fail(404, 'Tu ne peux supprimer que ce que tu as ajouté.');
  return json({ ok: true });
}
