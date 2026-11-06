import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;

/**
 * Renvoie l'email de la personne connectée via Cloudflare Access.
 * Le JWT est vérifié : sans ça, n'importe qui pourrait forger l'en-tête email.
 * En local uniquement (DEV_MODE=1 dans .dev.vars), on accepte l'en-tête x-dev-email.
 */
export async function getEmail(request, env) {
  if (env.DEV_MODE === '1') {
    return request.headers.get('x-dev-email') || env.DEV_EMAIL || null;
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
  return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
}
