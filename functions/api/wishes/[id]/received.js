import { json, fail, readJson } from '../../../../server/http.js';

// « Reçu, merci ! » sur sa propre envie : elle passe dans ses archives (ou en revient).
export async function onRequestPost({ request, env, data, params }) {
  const received = (await readJson(request))?.received !== false;
  const result = await env.DB.prepare(
    `UPDATE wishes SET received_at = CASE WHEN ?3 THEN datetime('now') ELSE NULL END
     WHERE id = ?1 AND owner_id = ?2 AND added_by = ?2`,
  )
    .bind(Number(params.id), data.me.id, received ? 1 : 0)
    .run();
  if (!result.meta.changes) return fail(404, 'Envie introuvable.');
  return json({ ok: true });
}
