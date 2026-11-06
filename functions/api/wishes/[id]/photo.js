import { fail } from '../../../../server/http.js';

// Même règle de secret que visibleWishes : sur sa propre liste, on ne voit que ses envies à soi.
export async function onRequestGet({ env, data, params }) {
  const wish = await env.DB.prepare('SELECT owner_id, added_by, photo FROM wishes WHERE id = ?1')
    .bind(Number(params.id))
    .first();
  const hidden = wish && wish.owner_id === data.me.id && wish.added_by !== data.me.id;
  if (!wish || hidden || !wish.photo) return fail(404, 'Photo introuvable.');

  const base64 = wish.photo.slice(wish.photo.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' },
  });
}
