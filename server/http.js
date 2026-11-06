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

// Un lien, même tapé à la main : « amazon.fr/truc » devient https://amazon.fr/truc. Le reste est ignoré.
export function cleanUrl(value) {
  let text = clean(value, 2000);
  if (!text) return null;
  if (!/^[a-z]+:\/\//i.test(text) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text)) text = `https://${text}`;
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

// Recadrage d'une photo : "x,y,zoom", x et y en % (0 à 100), zoom de 1 à 3. Sinon null (image entière).
export function cleanFrame(value) {
  const parts = String(value ?? '').split(',').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, zoom] = parts;
  const clamp = (n, min, max) => Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
  return `${clamp(x, 0, 100)},${clamp(y, 0, 100)},${clamp(zoom, 1, 3)}`;
}
