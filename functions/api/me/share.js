import { json, readJson } from '../../../server/http.js';
import { b64url } from '../../../server/push.js';

// Lien de partage de ma liste hors de la famille (lecture seule) : on le crée, on le change, ou on le coupe.
// { enabled: true } crée un nouveau lien (l'ancien ne marche plus) ; { enabled: false } le supprime.
export async function onRequestPost({ request, env, data }) {
  const enabled = (await readJson(request))?.enabled !== false;
  const token = enabled ? b64url(crypto.getRandomValues(new Uint8Array(16))) : null;
  await env.DB.prepare('UPDATE users SET share_token = ?2 WHERE id = ?1').bind(data.me.id, token).run();
  return json({ share_token: token });
}
