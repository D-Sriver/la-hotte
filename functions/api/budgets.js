import { json, fail, readJson } from '../../server/http.js';

// Mon budget pour une personne (privé : jamais montré à personne d'autre). amount null : plus de budget.
export async function onRequestPut({ request, env, data }) {
  const body = await readJson(request);
  const personId = Number(body?.person_id);
  if (!personId || personId === data.me.id) return fail(400, 'Personne inconnue.');
  const shared = await env.DB.prepare(
    `SELECT 1 FROM memberships a JOIN memberships b ON b.family_id = a.family_id
     WHERE a.user_id = ?1 AND b.user_id = ?2`,
  )
    .bind(data.me.id, personId)
    .first();
  if (!shared) return fail(404, 'Personne introuvable dans tes familles.');
  const amount = Number(String(body.amount ?? '').replace(',', '.'));
  if (body.amount === null || body.amount === '' || !(amount > 0)) {
    await env.DB.prepare('DELETE FROM gift_budgets WHERE user_id = ?1 AND person_id = ?2')
      .bind(data.me.id, personId)
      .run();
    return json({ amount: null });
  }
  const rounded = Math.min(Math.round(amount * 100) / 100, 100000);
  await env.DB.prepare(
    `INSERT INTO gift_budgets (user_id, person_id, amount) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id, person_id) DO UPDATE SET amount = excluded.amount`,
  )
    .bind(data.me.id, personId, rounded)
    .run();
  return json({ amount: rounded });
}
