import { json, fail, readJson, clean } from '../../server/http.js';
import { logError } from '../../server/errors.js';

// Une erreur vue dans le navigateur de quelqu'un de la famille.
export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const message = clean(body?.message, 500);
  if (!message) return fail(400, 'Erreur vide.');
  await logError(env.DB, {
    source: 'client',
    userId: data.me.id,
    message,
    detail: clean(body.stack, 4000),
    page: clean(body.page, 300),
    userAgent: request.headers.get('user-agent') || '',
  });
  return json({ ok: true });
}
