import { getEmail } from '../../server/auth.js';
import { fail } from '../../server/http.js';
import { myFamilies } from '../../server/family.js';

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

  // La famille affichée vient de l'en-tête x-family ; sinon la première de la personne.
  data.families = await myFamilies(env.DB, data.me.id);
  const wanted = Number(request.headers.get('x-family'));
  data.family = data.families.find((f) => f.id === wanted) || data.families[0] || null;

  // Access laisse entrer n'importe quelle adresse : tant qu'on n'a ni créé ni rejoint de famille,
  // seules ces routes répondent.
  const path = new URL(request.url).pathname;
  const allowedWithoutFamily = (path === '/api/me')
    || path === '/api/join'
    || (path === '/api/families' && request.method === 'POST');
  if (!data.family && !allowedWithoutFamily) return fail(403, 'Crée ou rejoins une famille pour continuer.');

  try {
    return await context.next();
  } catch (err) {
    console.error(err);
    return fail(500, 'Erreur serveur. Réessaie dans un instant.');
  }
}
