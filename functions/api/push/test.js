import { json, fail } from '../../../server/http.js';
import { pushConfigured, sendPush } from '../../../server/push.js';

// Une notification d'essai sur tous ses appareils. En cas d'échec, on dit pourquoi.
export async function onRequestPost({ env, data }) {
  if (!pushConfigured(env)) return fail(503, 'Les notifications ne sont pas encore configurées.');
  const { results } = await env.DB.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?1',
  )
    .bind(data.me.id)
    .all();
  if (!results.length) return fail(404, 'Aucun appareil inscrit. Active les notifications sur cet appareil.');

  const message = {
    title: 'La Hotte 🎁',
    body: `Ça marche, ${data.me.name || 'toi'}. Tu recevras ici les rappels, les cagnottes et les messages.`,
    url: '/#/',
  };
  let sent = 0;
  const problems = [];
  for (const sub of results) {
    const outcome = await sendPush(env, sub, message).catch((err) => `erreur : ${err.message}`);
    if (outcome === 'sent') sent++;
    else if (outcome === 'gone')
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?1').bind(sub.id).run();
    else problems.push(`${new URL(sub.endpoint).host} : ${outcome}`);
  }
  if (!sent) {
    console.warn('push test', problems);
    return fail(
      502,
      problems.length
        ? `L’envoi a échoué (${problems.join(' ; ')}).`
        : 'Cet appareil n’était plus inscrit. Réactive les notifications ici.',
    );
  }
  return json({ sent, devices: results.length });
}
