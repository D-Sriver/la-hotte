import { json } from '../../../server/http.js';
import { christmasRecap } from '../../../server/christmas.js';

// Les membres de la famille affichée, avec le nombre d'envies que chacun peut voir.
export async function onRequestGet({ env, data }) {
  const [{ results }, christmas] = await Promise.all([
    env.DB.prepare(
      `SELECT u.id, u.name, substr(u.birthday, 6) AS birthday,
       (SELECT COUNT(*) FROM wishes w WHERE w.owner_id = u.id
          AND (w.family_id IS NULL OR w.family_id = ?2) AND w.received_at IS NULL AND w.removed_at IS NULL
          AND (u.id != ?1 OR w.added_by = u.id)) AS wish_count
     FROM users u JOIN memberships m ON m.user_id = u.id AND m.family_id = ?2
     WHERE u.name IS NOT NULL
     ORDER BY (u.id = ?1) DESC, u.name COLLATE NOCASE`,
    )
      .bind(data.me.id, data.family.id)
      .all(),
    // Du 26 décembre au 31 janvier : qui m'a offert quoi.
    christmasRecap(env.DB, data.me.id),
  ]);
  return json({ people: results.map((p) => ({ ...p, is_me: p.id === data.me.id })), christmas });
}
