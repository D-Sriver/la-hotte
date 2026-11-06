import { json, fail } from '../../../server/http.js';

export async function onRequestDelete({ env, data, params }) {
  const result = await env.DB.prepare('DELETE FROM wishes WHERE id = ?1 AND added_by = ?2')
    .bind(Number(params.id), data.me.id)
    .run();
  if (!result.meta.changes) return fail(404, 'Tu ne peux supprimer que ce que tu as ajouté.');
  return json({ ok: true });
}
