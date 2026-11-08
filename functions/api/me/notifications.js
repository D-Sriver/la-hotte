import { json, fail, readJson } from '../../../server/http.js';

// Ce qu'on reçoit en notification. Seuls les choix envoyés changent.
const COLUMNS = {
  reminders: 'notify_email',
  messages: 'notify_messages',
  groups: 'notify_groups',
  prices: 'notify_prices',
};

export async function onRequestPut({ request, env, data }) {
  const body = await readJson(request);
  const changes = Object.entries(COLUMNS).filter(([key]) => typeof body?.[key] === 'boolean');
  if (!changes.length) return fail(400, 'Rien à changer.');
  const sets = changes.map(([, column], i) => `${column} = ?${i + 2}`).join(', ');
  const me = await env.DB.prepare(
    `UPDATE users SET ${sets} WHERE id = ?1 RETURNING notify_email, notify_messages, notify_groups, notify_prices`,
  )
    .bind(data.me.id, ...changes.map(([key]) => (body[key] ? 1 : 0)))
    .first();
  return json({
    reminders: !!me.notify_email,
    messages: !!me.notify_messages,
    groups: !!me.notify_groups,
    prices: !!me.notify_prices,
  });
}
