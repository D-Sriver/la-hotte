import { json, readJson } from '../../../server/http.js';
import { b64url } from '../../../server/push.js';

// Lien d'abonnement aux anniversaires : { enabled: true } en crée un nouveau (l'ancien ne marche plus),
// { enabled: false } le coupe.
export async function onRequestPost({ request, env, data }) {
  const enabled = (await readJson(request))?.enabled !== false;
  const token = enabled ? b64url(crypto.getRandomValues(new Uint8Array(16))) : null;
  await env.DB.prepare('UPDATE users SET calendar_token = ?2 WHERE id = ?1').bind(data.me.id, token).run();
  return json({ calendar_token: token });
}
