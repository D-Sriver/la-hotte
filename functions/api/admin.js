import { json, fail } from '../../server/http.js';
import { adminStats } from '../../server/admin.js';

export async function onRequestGet({ env, data }) {
  if (!data.me.is_admin) return fail(403, 'Réservé à l’administrateur.');
  return json(await adminStats(env));
}
