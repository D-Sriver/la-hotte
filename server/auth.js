import { createRemoteJWKSet, jwtVerify } from 'jose';
import { emailFromSession } from './session.js';

let jwks;

// Connexion par code email (AUTH_MODE = "email") ou par Cloudflare Access (par défaut).
export const usesEmailLogin = (env) => env.AUTH_MODE === 'email';

/**
 * Renvoie l'email de la personne connectée : par le cookie de session (connexion par email),
 * ou via Cloudflare Access, dont le JWT est vérifié (sinon n'importe qui pourrait forger l'en-tête).
 * En local uniquement (DEV_MODE=1 dans .dev.vars), on accepte l'en-tête x-dev-email.
 */
export async function getEmail(request, env) {
  if (env.DEV_MODE === '1') {
    // ?as= aussi, pour les <img> qui ne peuvent pas envoyer d'en-tête.
    const devEmail = request.headers.get('x-dev-email') || new URL(request.url).searchParams.get('as');
    if (devEmail || !usesEmailLogin(env)) return devEmail || env.DEV_EMAIL || null;
  }
  if (usesEmailLogin(env)) return emailFromSession(request, env);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
  return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
}
