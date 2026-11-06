import { json, fail } from '../../../server/http.js';
import { notifyUser, pushConfigured } from '../../../server/push.js';

// Une notification d'essai sur tous ses appareils.
export async function onRequestPost({ env, data }) {
  if (!pushConfigured(env)) return fail(503, 'Les notifications ne sont pas encore configurées.');
  const sent = await notifyUser(env, data.me.id, {
    title: 'La Hotte 🎁',
    body: `Ça marche, ${data.me.name || 'toi'} ! Tu recevras ici les rappels de Noël et des anniversaires.`,
    url: '/#/',
  });
  if (!sent) return fail(502, 'Aucun appareil n’a reçu la notification. Réactive-les sur ce téléphone.');
  return json({ sent });
}
