export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const fail = (status, message) => json({ error: message }, status);

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const clean = (value, max = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export function cleanUrl(value) {
  const text = clean(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// Photo envoyée par le navigateur, déjà réduite en JPEG. On refuse tout le reste.
const PHOTO_PREFIX = 'data:image/jpeg;base64,';
export function cleanPhoto(value) {
  if (typeof value !== 'string' || !value.startsWith(PHOTO_PREFIX)) return null;
  if (value.length > 700_000) return null;
  return /^[A-Za-z0-9+/=]+$/.test(value.slice(PHOTO_PREFIX.length)) ? value : null;
}
