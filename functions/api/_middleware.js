import { getEmail } from '../../server/auth.js';
import { fail } from '../../server/http.js';

export async function onRequest(context) {
  const { request, env, data } = context;
  let email;
  try {
    email = await getEmail(request, env);
  } catch {
    return fail(401, 'Session expirée. Recharge la page pour te reconnecter.');
  }
  if (!email) return fail(401, 'Connexion requise.');

  await env.DB.prepare('INSERT INTO users (email) VALUES (?1) ON CONFLICT(email) DO NOTHING')
    .bind(email.toLowerCase())
    .run();
  data.me = await env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email.toLowerCase()).first();

  // Access laisse entrer n'importe quelle adresse : tant que le code familial n'est pas saisi,
  // seules /api/me (pour savoir où on en est) et /api/join répondent.
  const path = new URL(request.url).pathname;
  const allowedBeforeJoin = (path === '/api/me' && request.method === 'GET') || path === '/api/join';
  if (!data.me.joined && !allowedBeforeJoin) return fail(403, 'Entre le code familial pour continuer.');

  try {
    return await context.next();
  } catch (err) {
    console.error(err);
    return fail(500, 'Erreur serveur. Réessaie dans un instant.');
  }
}
