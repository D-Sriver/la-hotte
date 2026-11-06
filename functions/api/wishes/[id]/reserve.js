import { json, fail, readJson } from '../../../../server/http.js';

/**
 * Tout ce qu'on peut faire sur le cadeau de quelqu'un d'autre :
 * - reserve : réserver seul, ou annuler sa réservation ;
 * - group   : lancer un cadeau à plusieurs (on en devient l'organisateur) ;
 * - join / leave : participer à un cadeau à plusieurs, ou s'en retirer ;
 * - bought  : cocher / décocher « acheté ».
 */
export async function onRequestPost({ request, env, data, params }) {
  const body = (await readJson(request)) || {};
  const action = body.action || 'reserve';
  const me = data.me.id;
  const db = env.DB;

  const wish = await db.prepare('SELECT id, owner_id, reserved_by, group_gift, bought FROM wishes WHERE id = ?1')
    .bind(Number(params.id))
    .first();
  if (!wish) return fail(404, 'Idée introuvable.');
  if (wish.owner_id === me) return fail(403, 'Pas de réservation sur ta propre liste.');

  const participating = !!(await db.prepare('SELECT 1 FROM contributions WHERE wish_id = ?1 AND user_id = ?2')
    .bind(wish.id, me).first());
  const update = (sql, ...values) => db.prepare(`UPDATE wishes SET ${sql} WHERE id = ?1`).bind(wish.id, ...values);
  const addMe = db.prepare('INSERT OR IGNORE INTO contributions (wish_id, user_id) VALUES (?1, ?2)').bind(wish.id, me);
  const free = wish.reserved_by === null;

  switch (action) {
    case 'reserve': {
      if (free) {
        await update("reserved_by = ?2, reserved_at = datetime('now'), group_gift = 0, bought = 0", me).run();
        return json({ ok: true });
      }
      if (wish.reserved_by === me && !wish.group_gift) {
        await update('reserved_by = NULL, reserved_at = NULL, bought = 0').run();
        return json({ ok: true });
      }
      return fail(409, 'Déjà réservé par quelqu’un d’autre.');
    }
    case 'group': {
      if (!free && wish.reserved_by !== me) return fail(409, 'Déjà réservé par quelqu’un d’autre.');
      await db.batch([
        update("reserved_by = ?2, reserved_at = COALESCE(reserved_at, datetime('now')), group_gift = 1", me),
        addMe,
      ]);
      return json({ ok: true });
    }
    case 'join': {
      if (!wish.group_gift) return fail(409, 'Ce cadeau n’est pas ouvert à plusieurs.');
      await addMe.run();
      return json({ ok: true });
    }
    case 'leave': {
      if (!participating) return fail(409, 'Tu ne participes pas à ce cadeau.');
      await db.prepare('DELETE FROM contributions WHERE wish_id = ?1 AND user_id = ?2').bind(wish.id, me).run();
      const next = await db.prepare('SELECT user_id FROM contributions WHERE wish_id = ?1 ORDER BY created_at LIMIT 1')
        .bind(wish.id).first();
      if (!next) await update('reserved_by = NULL, reserved_at = NULL, group_gift = 0, bought = 0').run();
      // L'organisateur s'en va : le plus ancien participant reprend le flambeau.
      else if (wish.reserved_by === me) await update('reserved_by = ?2', next.user_id).run();
      return json({ ok: true });
    }
    case 'bought': {
      if (wish.reserved_by !== me && !participating) return fail(403, 'Réserve d’abord ce cadeau.');
      await update('bought = ?2', wish.bought ? 0 : 1).run();
      return json({ ok: true });
    }
    default:
      return fail(400, 'Action inconnue.');
  }
}
