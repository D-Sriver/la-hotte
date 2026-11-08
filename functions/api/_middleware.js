import { getEmail, usesEmailLogin } from '../../server/auth.js';
import { crossSiteProblem, fail, json } from '../../server/http.js';
import { myFamilies } from '../../server/family.js';
import { logError } from '../../server/errors.js';

export async function onRequest(context) {
  const { request, env, data } = context;
  // Avant tout, connexion comprise : une écriture doit venir de La Hotte.
  const crossSite = crossSiteProblem(request);
  if (crossSite) return fail(403, crossSite);
  // La connexion elle-même (envoi et vérification du code) ne demande pas d'être connecté.
  if (new URL(request.url).pathname.startsWith('/api/auth/')) return context.next();
  let email;
  try {
    email = await getEmail(request, env);
  } catch {
    return fail(401, 'Session expirée. Recharge la page pour te reconnecter.');
  }
  // `login` dit au site d'afficher l'écran de connexion par email.
  if (!email) return json({ error: 'Connexion requise.', login: usesEmailLogin(env) }, 401);

  await env.DB.prepare('INSERT INTO users (email) VALUES (?1) ON CONFLICT(email) DO NOTHING')
    .bind(email.toLowerCase())
    .run();
  data.me = await env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email.toLowerCase()).first();
  // Dernière visite, notée au plus une fois par heure (membres actifs du tableau de bord).
  if (!data.me.last_seen_at || Date.parse(`${data.me.last_seen_at.replace(' ', 'T')}Z`) < Date.now() - 3_600_000) {
    context.waitUntil?.(
      env.DB.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?1")
        .bind(data.me.id)
        .run()
        .catch(() => {}),
    );
  }

  // La famille affichée vient de l'en-tête x-family ; sinon la première de la personne.
  data.families = await myFamilies(env.DB, data.me.id);
  const wanted = Number(request.headers.get('x-family'));
  data.family = data.families.find((f) => f.id === wanted) || data.families[0] || null;

  // Access laisse entrer n'importe quelle adresse : tant qu'on n'a ni créé ni rejoint de famille,
  // seules ces routes répondent.
  const path = new URL(request.url).pathname;
  const allowedWithoutFamily =
    path === '/api/me' ||
    path === '/api/join' ||
    path === '/api/errors' ||
    (path === '/api/families' && request.method === 'POST');
  if (!data.family && !allowedWithoutFamily) return fail(403, 'Crée ou rejoins une famille pour continuer.');

  try {
    return await context.next();
  } catch (err) {
    console.error(err);
    // Gardée dans le journal (npm run errors), sans ralentir la réponse.
    context.waitUntil?.(
      logError(env.DB, {
        source: 'server',
        userId: data.me.id,
        message: err?.message || String(err),
        detail: `${request.method} ${path}\n${err?.stack || ''}`,
        userAgent: request.headers.get('user-agent') || '',
      }).catch(() => {}),
    );
    return fail(500, 'Erreur serveur. Réessaie dans un instant.');
  }
}
