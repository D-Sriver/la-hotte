// Notifications « Web Push » sans bibliothèque : signature VAPID (RFC 8292) et chiffrement aes128gcm (RFC 8291),
// avec le WebCrypto des Workers. Clés : VAPID_PUBLIC_KEY (base64url, 65 octets) et VAPID_PRIVATE_KEY (JWK JSON).

const enc = new TextEncoder();

export const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function fromB64url(text) {
  const base64 = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

export const pushConfigured = (env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

// Jeton VAPID : prouve au service de push (Google, Apple, Mozilla) que c'est bien La Hotte qui envoie.
async function vapidHeader(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || 'https://la-hotte.pages.dev',
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(`${header}.${claims}`),
  );
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

// Chiffre le message pour un seul appareil : seul ce téléphone pourra le lire.
export async function encryptPayload(subscription, payload) {
  const uaPublic = fromB64url(subscription.p256dh);
  const authSecret = fromB64url(subscription.auth);

  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256),
  );

  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 : dernier (et unique) bloc, sans bourrage.
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

// Envoie une notification. Renvoie 'sent', 'gone' (abonnement expiré : à supprimer) ou la raison du refus.
export async function sendPush(env, subscription, message) {
  const body = await encryptPayload(subscription, JSON.stringify(message));
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidHeader(env, subscription.endpoint),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(24 * 3600),
      urgency: 'normal',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404 || response.status === 410) return 'gone';
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    console.warn('push', response.status, detail);
    return `refus ${response.status}${detail ? ` ${detail.slice(0, 80)}` : ''}`;
  }
  return 'sent';
}

// Envoie à tous les appareils d'une personne ; nettoie les abonnements expirés. Renvoie le nombre d'envois réussis.
export async function notifyUser(env, userId, message) {
  const { results } = await env.DB.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?1',
  )
    .bind(userId)
    .all();
  let sent = 0;
  for (const sub of results) {
    const outcome = await sendPush(env, sub, message).catch((err) => {
      console.warn('push', err.message);
      return 'failed';
    });
    if (outcome === 'sent') sent++;
    if (outcome === 'gone') await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?1').bind(sub.id).run();
  }
  return sent;
}
