import { fail, readJson } from '../../../server/http.js';
import { usesEmailLogin } from '../../../server/auth.js';
import { hashCode, sessionCookie } from '../../../server/session.js';

const MAX_ATTEMPTS = 5;

// Étape 2 : le bon code ouvre une session (cookie de 60 jours).
export async function onRequestPost({ request, env }) {
  if (!usesEmailLogin(env)) return fail(404, 'Connexion par email désactivée.');
  const body = await readJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  const code = String(body?.code || '').replace(/\D/g, '');

  const pending = await env.DB.prepare(
    `SELECT id, code_hash, attempts FROM login_codes
     WHERE email = ?1 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`,
  ).bind(email).first();
  if (!pending || pending.attempts >= MAX_ATTEMPTS) return fail(400, 'Code expiré. Demandes-en un nouveau.');

  if (code.length !== 6 || (await hashCode(env, email, code)) !== pending.code_hash) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?1').bind(pending.id).run();
    return fail(400, 'Ce n’est pas le bon code.');
  }

  await env.DB.prepare('DELETE FROM login_codes WHERE email = ?1').bind(email).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': await sessionCookie(env, email) },
  });
}
