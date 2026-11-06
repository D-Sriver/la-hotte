import { json, fail, readJson, cleanUrl } from '../../server/http.js';
import { previewLink } from '../../server/preview.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const url = cleanUrl(body?.url);
  if (!url) return fail(400, 'Lien invalide.');
  try {
    return json(await previewLink(url, env));
  } catch (err) {
    console.warn('preview', url, err.message);
    return fail(422, 'Ce site ne se laisse pas lire, remplis à la main.');
  }
}
