import { fail } from '../../../../server/http.js';

// Même règle de secret que visibleWishes. Une <img> n'envoie pas la famille affichée :
// on accepte toute famille que l'on partage avec la personne (et celle de l'idée secrète).
// ?p=<numéro> : une photo précise du carrousel. Chaque photo a son numéro et ne change jamais : cache long.
export async function onRequestGet({ request, env, data, params }) {
  const me = data.me.id;
  const photoId = Number(new URL(request.url).searchParams.get('p'));
  const row = await env.DB.prepare(
    `SELECT w.owner_id, w.added_by, p.photo FROM wishes w JOIN wish_photos p ON p.wish_id = w.id
     WHERE w.id = ?1 AND p.id = ?3 AND (
       w.owner_id = ?2
       OR (w.family_id IS NULL AND EXISTS (
             SELECT 1 FROM memberships a JOIN memberships b ON b.family_id = a.family_id
             WHERE a.user_id = ?2 AND b.user_id = w.owner_id))
       OR EXISTS (SELECT 1 FROM memberships s WHERE s.family_id = w.family_id AND s.user_id = ?2)
     )`,
  )
    .bind(Number(params.id), me, photoId)
    .first();
  const hidden = row && row.owner_id === me && row.added_by !== me;
  if (!row || hidden) return fail(404, 'Photo introuvable.');

  const base64 = row.photo.slice(row.photo.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' },
  });
}
