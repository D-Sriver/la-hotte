import { json } from '../../../server/http.js';

export async function onRequestGet({ env, data }) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name,
       (SELECT COUNT(*) FROM wishes w WHERE w.owner_id = u.id
          AND (u.id != ?1 OR w.added_by = u.id)) AS wish_count
     FROM users u WHERE u.name IS NOT NULL
     ORDER BY (u.id = ?1) DESC, u.name COLLATE NOCASE`,
  )
    .bind(data.me.id)
    .all();
  return json({ people: results.map((p) => ({ ...p, is_me: p.id === data.me.id })) });
}
