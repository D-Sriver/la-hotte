import { json, fail, readJson, clean, cleanUrl } from '../../../server/http.js';
import { checkPhotos, savePhotos } from '../../../server/photos.js';

// Modifier : seulement ce qu'on a ajouté soi-même.
export async function onRequestPut({ request, env, data, params }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const wish = await env.DB.prepare('SELECT id, owner_id, added_by, removed_at FROM wishes WHERE id = ?1')
    .bind(Number(params.id))
    .first();
  if (!wish || wish.added_by !== data.me.id || wish.removed_at)
    return fail(404, 'Tu ne peux modifier que ce que tu as ajouté.');

  const title = clean(body.title, 200);
  if (!title) return fail(400, 'Donne un nom à l’idée.');
  // photos : absente = on garde tout ; sinon la liste complète dans l'ordre ({ id } gardée, { data } ajoutée).
  const photoError = checkPhotos(body.photos);
  if (photoError) return fail(400, photoError);
  // Le coup de cœur n'a de sens que sur sa propre liste.
  const favorite = wish.owner_id === data.me.id && body.favorite ? 1 : 0;

  // edited_at : celui qui offre est prévenu si le propriétaire change son envie après la réservation.
  await env.DB.prepare(
    `UPDATE wishes SET title = ?1, url = ?2, price = ?3, note = ?4, favorite = ?5,
       edited_at = CASE WHEN owner_id = added_by AND (title != ?1 OR COALESCE(url, '') != COALESCE(?2, '')
         OR COALESCE(price, '') != ?3 OR COALESCE(note, '') != ?4) THEN datetime('now') ELSE edited_at END
     WHERE id = ?6`,
  )
    .bind(title, cleanUrl(body.url), clean(body.price, 40), clean(body.note, 500), favorite, wish.id)
    .run();
  if (body.photos !== undefined) {
    const error = await savePhotos(env.DB, wish.id, body.photos);
    if (error) return fail(400, error);
  }
  return json({ ok: true });
}

// Supprimer. Une envie à soi déjà réservée (le propriétaire ne peut pas le savoir) n'est que retirée :
// elle quitte sa liste, mais celui qui l'offre la garde, avec la mention « retirée de sa liste ».
export async function onRequestDelete({ env, data, params }) {
  const wish = await env.DB.prepare('SELECT id, owner_id, added_by, reserved_by, removed_at FROM wishes WHERE id = ?1')
    .bind(Number(params.id))
    .first();
  if (!wish || wish.added_by !== data.me.id || wish.removed_at)
    return fail(404, 'Tu ne peux supprimer que ce que tu as ajouté.');
  if (wish.owner_id === data.me.id && wish.reserved_by !== null) {
    await env.DB.prepare("UPDATE wishes SET removed_at = datetime('now'), favorite = 0 WHERE id = ?1")
      .bind(wish.id)
      .run();
  } else {
    await env.DB.prepare('DELETE FROM wishes WHERE id = ?1').bind(wish.id).run();
  }
  return json({ ok: true });
}
