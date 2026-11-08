import { json, fail, readJson } from '../../../server/http.js';
import { deleteAccount, exportMyData } from '../../../server/account.js';

// GET : télécharger mes données. DELETE : supprimer mon compte (il faut retaper son prénom).
export async function onRequestGet({ env, data }) {
  const body = JSON.stringify(await exportMyData(env.DB, data.me.id), null, 2);
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="la-hotte-mes-donnees.json"',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequestDelete({ request, env, data }) {
  const typed = String((await readJson(request))?.confirm || '')
    .trim()
    .toLowerCase();
  if (!data.me.name || typed !== data.me.name.trim().toLowerCase())
    return fail(400, 'Tape ton prénom pour confirmer la suppression.');
  await deleteAccount(env.DB, data.me.id);
  return json({ ok: true });
}
