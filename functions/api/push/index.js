import { json, fail, readJson } from '../../../server/http.js';
import { pushConfigured } from '../../../server/push.js';

// La clé publique pour s'abonner, et le nombre d'appareils déjà abonnés.
export async function onRequestGet({ env, data }) {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?1').bind(data.me.id).first();
  return json({ configured: pushConfigured(env), public_key: env.VAPID_PUBLIC_KEY || null, devices: n });
}

const cleanKey = (value) => (typeof value === 'string' && /^[A-Za-z0-9_-]{16,200}$/.test(value) ? value : null);

// S'abonner sur cet appareil (ou remettre à jour l'abonnement).
export async function onRequestPost({ request, env, data }) {
  if (!pushConfigured(env)) return fail(503, 'Les notifications ne sont pas encore configurées.');
  const body = await readJson(request);
  const endpoint = typeof body?.endpoint === 'string' && body.endpoint.startsWith('https://') ? body.endpoint.slice(0, 1000) : null;
  const p256dh = cleanKey(body?.keys?.p256dh);
  const auth = cleanKey(body?.keys?.auth);
  if (!endpoint || !p256dh || !auth) return fail(400, 'Abonnement illisible.');
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).bind(data.me.id, endpoint, p256dh, auth).run();
  return json({ ok: true }, 201);
}

// Se désabonner sur cet appareil.
export async function onRequestDelete({ request, env, data }) {
  const endpoint = (await readJson(request))?.endpoint;
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint = ?2').bind(data.me.id, String(endpoint || '')).run();
  return json({ ok: true });
}
