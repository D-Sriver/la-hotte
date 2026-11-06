import { json, fail, readJson } from '../../server/http.js';

const MAX_FAILURES = 5;

const normalize = (code) => String(code || '').trim().toLowerCase();

export async function onRequestPost({ request, env, data }) {
  if (data.me.joined) return json({ ok: true });
  if (!env.FAMILY_CODE) return fail(500, 'Le code familial n’est pas configuré.');
  if (data.me.join_failures >= MAX_FAILURES) {
    return fail(429, 'Trop d’essais. Demande à quelqu’un de la famille de te débloquer.');
  }

  const body = await readJson(request);
  if (normalize(body?.code) !== normalize(env.FAMILY_CODE)) {
    await env.DB.prepare('UPDATE users SET join_failures = join_failures + 1 WHERE id = ?1')
      .bind(data.me.id)
      .run();
    return fail(400, 'Ce n’est pas le bon code.');
  }

  await env.DB.prepare('UPDATE users SET joined = 1, join_failures = 0 WHERE id = ?1').bind(data.me.id).run();
  return json({ ok: true });
}
