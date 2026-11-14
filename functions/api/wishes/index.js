import { json, fail, readJson, clean, cleanUrl, cleanDay } from '../../../server/http.js';
import { checkPhotos, savePhotos } from '../../../server/photos.js';
import { personInFamily } from '../../../server/wishes.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const ownerId = Number(body.owner_id) || data.me.id;
  const title = clean(body.title, 200);
  if (!title) return fail(400, 'Donne un nom à l’idée.');
  // Nouvelles photos seulement (une envie qui vient d'être créée n'en a pas encore).
  const photos = Array.isArray(body.photos) ? body.photos.map((p) => ({ data: p?.data, frame: p?.frame })) : undefined;
  const photoError = checkPhotos(photos);
  if (photoError) return fail(400, photoError);

  const forMe = ownerId === data.me.id;
  // Un cadeau déjà reçu, saisi à la main : il va directement dans ses archives.
  const received = forMe && body.received === true;
  if (!forMe && !(await personInFamily(env.DB, ownerId, data.family.id)))
    return fail(404, 'Personne introuvable dans cette famille.');

  const wish = await env.DB.prepare(
    `INSERT INTO wishes (owner_id, added_by, title, url, price, note, favorite, family_id, received_at, received_from)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CASE WHEN ?9 THEN COALESCE(?10, datetime('now')) END, ?11) RETURNING id`,
  )
    .bind(
      ownerId,
      data.me.id,
      title,
      cleanUrl(body.url),
      clean(body.price, 40),
      clean(body.note, 500),
      forMe && body.favorite && !received ? 1 : 0,
      // Ses envies sont pour toutes ses familles ; une idée secrète reste dans la famille affichée.
      forMe ? null : data.family.id,
      received ? 1 : 0,
      cleanDay(body.received_on),
      received ? clean(body.received_from, 60) || null : null,
    )
    .first();
  if (photos) await savePhotos(env.DB, wish.id, photos);
  return json({ id: wish.id }, 201);
}
