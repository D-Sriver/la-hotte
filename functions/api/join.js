import { json, fail, readJson } from '../../server/http.js';
import { normalizeCode } from '../../server/family.js';

const MAX_FAILURES = 8;

// Rejoindre une famille avec son code. Les mauvais codes sont comptés pour empêcher de les deviner.
export async function onRequestPost({ request, env, data }) {
  const me = data.me;
  const recentlyBlocked = me.join_failures >= MAX_FAILURES
    && me.join_failed_at && Date.parse(`${me.join_failed_at}Z`) > Date.now() - 3600_000;
  if (recentlyBlocked) return fail(429, 'Trop d’essais. Réessaie dans une heure.');

  const body = await readJson(request);
  const family = await env.DB.prepare('SELECT id, name FROM families WHERE code = ?1')
    .bind(normalizeCode(body?.code))
    .first();
  if (!family) {
    const failures = me.join_failures >= MAX_FAILURES ? 1 : me.join_failures + 1;
    await env.DB.prepare("UPDATE users SET join_failures = ?2, join_failed_at = datetime('now') WHERE id = ?1")
      .bind(me.id, failures)
      .run();
    return fail(400, 'Ce code ne correspond à aucune famille.');
  }

  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO memberships (family_id, user_id) VALUES (?1, ?2)').bind(family.id, me.id),
    env.DB.prepare('UPDATE users SET join_failures = 0 WHERE id = ?1').bind(me.id),
  ]);
  return json({ family });
}
