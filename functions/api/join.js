import { json, fail, readJson } from '../../server/http.js';
import { isMember, normalizeCode } from '../../server/family.js';

const MAX_FAILURES = 8;

const isBlocked = (me) => me.join_failures >= MAX_FAILURES
  && me.join_failed_at && Date.parse(`${me.join_failed_at}Z`) > Date.now() - 3600_000;

// Retrouve la famille d'un code. Les mauvais codes sont comptés pour empêcher de les deviner.
async function findFamily(env, me, code) {
  const family = await env.DB.prepare(
    `SELECT f.id, f.name, (SELECT COUNT(*) FROM memberships m WHERE m.family_id = f.id) AS member_count
     FROM families f WHERE f.code = ?1`,
  )
    .bind(normalizeCode(code))
    .first();
  if (!family) {
    const failures = me.join_failures >= MAX_FAILURES ? 1 : me.join_failures + 1;
    await env.DB.prepare("UPDATE users SET join_failures = ?2, join_failed_at = datetime('now') WHERE id = ?1")
      .bind(me.id, failures)
      .run();
  }
  return family;
}

// Lien d'invitation : quelle famille se cache derrière ce code, et en fait-on déjà partie ?
export async function onRequestGet({ request, env, data }) {
  const me = data.me;
  if (isBlocked(me)) return fail(429, 'Trop d’essais. Réessaie dans une heure.');
  const family = await findFamily(env, me, new URL(request.url).searchParams.get('code'));
  if (!family) return fail(404, 'Ce lien d’invitation ne correspond à aucune famille.');
  // Les prénoms des membres, pour savoir qui on rejoint.
  const { results } = await env.DB.prepare(
    `SELECT u.name FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.family_id = ?1 AND u.name IS NOT NULL ORDER BY m.joined_at LIMIT 6`,
  ).bind(family.id).all();
  return json({ family: { ...family, members: results.map((r) => r.name) }, member: await isMember(env.DB, family.id, me.id) });
}

// Rejoindre une famille avec son code.
export async function onRequestPost({ request, env, data }) {
  const me = data.me;
  if (isBlocked(me)) return fail(429, 'Trop d’essais. Réessaie dans une heure.');

  const body = await readJson(request);
  const family = await findFamily(env, me, body?.code);
  if (!family) return fail(400, 'Ce code ne correspond à aucune famille.');

  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO memberships (family_id, user_id) VALUES (?1, ?2)').bind(family.id, me.id),
    env.DB.prepare('UPDATE users SET join_failures = 0 WHERE id = ?1').bind(me.id),
  ]);
  return json({ family });
}
