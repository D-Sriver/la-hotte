import { fail } from '../../../../server/http.js';

// Même règle de secret que visibleWishes. Une <img> n'envoie pas la famille affichée :
// on accepte toute famille que l'on partage avec la personne (et celle de l'idée secrète).
export async function onRequestGet({ env, data, params }) {
  const me = data.me.id;
  const wish = await env.DB.prepare(
    `SELECT w.owner_id, w.added_by, w.family_id, w.photo FROM wishes w
     WHERE w.id = ?1 AND (
       w.owner_id = ?2
       OR (w.family_id IS NULL AND EXISTS (
             SELECT 1 FROM memberships a JOIN memberships b ON b.family_id = a.family_id
             WHERE a.user_id = ?2 AND b.user_id = w.owner_id))
       OR EXISTS (SELECT 1 FROM memberships s WHERE s.family_id = w.family_id AND s.user_id = ?2)
     )`,
  )
    .bind(Number(params.id), me)
    .first();
  const hidden = wish && wish.owner_id === me && wish.added_by !== me;
  if (!wish || hidden || !wish.photo) return fail(404, 'Photo introuvable.');

  const base64 = wish.photo.slice(wish.photo.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' },
  });
}
