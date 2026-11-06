import { json, fail } from '../../../../server/http.js';

// Réserve, ou annule sa propre réservation.
export async function onRequestPost({ env, data, params }) {
  const wish = await env.DB.prepare('SELECT id, owner_id, reserved_by FROM wishes WHERE id = ?1')
    .bind(Number(params.id))
    .first();
  if (!wish) return fail(404, 'Idée introuvable.');
  if (wish.owner_id === data.me.id) return fail(403, 'Pas de réservation sur ta propre liste.');
  if (wish.reserved_by && wish.reserved_by !== data.me.id) return fail(409, 'Déjà réservé par quelqu’un d’autre.');

  const reserving = wish.reserved_by === null;
  await env.DB.prepare(
    `UPDATE wishes SET reserved_by = ?1, reserved_at = CASE WHEN ?1 IS NULL THEN NULL ELSE datetime('now') END
     WHERE id = ?2`,
  )
    .bind(reserving ? data.me.id : null, wish.id)
    .run();
  return json({ reserved: reserving });
}
