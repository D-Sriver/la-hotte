import { SignJWT, jwtVerify } from 'jose';

// Session de la connexion par email : un jeton signé dans un cookie HttpOnly, valable 60 jours.
export const SESSION_COOKIE = 'hotte_session';
const MAX_AGE = 60 * 24 * 3600;

const keyOf = (env) => {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET manquant ou trop court.');
  return new TextEncoder().encode(env.SESSION_SECRET);
};

export async function sessionCookie(env, email) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(keyOf(env));
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export async function emailFromSession(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keyOf(env), { algorithms: ['HS256'] });
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

// Code à 6 chiffres ; on n'en garde que l'empreinte (mélangée au secret de session).
export function newLoginCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

export async function hashCode(env, email, code) {
  const data = new TextEncoder().encode(`${env.SESSION_SECRET}:${email}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
