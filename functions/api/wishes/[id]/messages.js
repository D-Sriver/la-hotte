import { json, fail, readJson, clean } from '../../../../server/http.js';
import { wishInFamily } from '../../../../server/wishes.js';
import { giftCircle, notifyLater, ownerName, recipients } from '../../../../server/notify.js';

// Discussion secrète entre ceux qui offrent : propre à la famille affichée, jamais visible
// par la personne gâtée.
async function openThread(env, data, params) {
  const wish = await wishInFamily(env.DB, Number(params.id), data.family.id);
  if (!wish || wish.owner_id === data.me.id) return null;
  return wish;
}

export async function onRequestGet({ env, data, params }) {
  const wish = await openThread(env, data, params);
  if (!wish) return fail(404, 'Discussion introuvable.');
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.body, m.created_at, m.user_id, u.name
     FROM wish_messages m JOIN users u ON u.id = m.user_id
     WHERE m.wish_id = ?1 AND m.family_id = ?2
     ORDER BY m.created_at, m.id`,
  )
    .bind(wish.id, data.family.id)
    .all();
  return json({ messages: results.map((m) => ({ ...m, mine: m.user_id === data.me.id })) });
}

export async function onRequestPost(context) {
  const { request, env, data, params } = context;
  const wish = await openThread(env, data, params);
  if (!wish) return fail(404, 'Discussion introuvable.');
  const body = clean((await readJson(request))?.body, 1000);
  if (!body) return fail(400, 'Message vide.');
  await env.DB.prepare('INSERT INTO wish_messages (wish_id, family_id, user_id, body) VALUES (?1, ?2, ?3, ?4)')
    .bind(wish.id, data.family.id, data.me.id, body)
    .run();

  const to = await recipients(env.DB, {
    userIds: await giftCircle(env.DB, wish, data.family.id),
    familyId: data.family.id,
    ownerId: wish.owner_id,
    senderId: data.me.id,
    kind: 'messages',
  });
  notifyLater(context, to, {
    title: `💬 ${wish.title} (pour ${await ownerName(env.DB, wish)})`,
    body: `${data.me.name} : ${body.slice(0, 140)}`,
    url: `/#/p/${wish.owner_id}`,
    tag: `chat-${wish.id}`,
  });
  return json({ ok: true }, 201);
}

// Effacer son propre message.
export async function onRequestDelete({ request, env, data, params }) {
  const id = Number(new URL(request.url).searchParams.get('message'));
  const result = await env.DB.prepare('DELETE FROM wish_messages WHERE id = ?1 AND wish_id = ?2 AND user_id = ?3')
    .bind(id, Number(params.id), data.me.id)
    .run();
  if (!result.meta.changes) return fail(404, 'Message introuvable.');
  return json({ ok: true });
}
