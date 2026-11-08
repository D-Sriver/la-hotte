import { json, fail } from '../../../../server/http.js';
import { notifyLater } from '../../../../server/notify.js';

// « Merci » depuis le récap de Noël : la personne gâtée remercie ceux qui lui ont offert ce cadeau.
// Une seule fois par cadeau ; ceux qui ont offert le voient aussi dans « Ce que j'offre ».
export async function onRequestPost(context) {
  const { env, data, params } = context;
  const db = env.DB;
  const wish = await db
    .prepare(
      `SELECT id, title, reserved_by, thanked_at FROM wishes
       WHERE id = ?1 AND owner_id = ?2 AND reserved_by IS NOT NULL AND received_at IS NOT NULL`,
    )
    .bind(Number(params.id), data.me.id)
    .first();
  if (!wish) return fail(404, 'Cadeau introuvable.');
  if (wish.thanked_at) return json({ ok: true, already: true });

  await db.prepare("UPDATE wishes SET thanked_at = datetime('now') WHERE id = ?1").bind(wish.id).run();
  const { results } = await db.prepare('SELECT user_id FROM contributions WHERE wish_id = ?1').bind(wish.id).all();
  const givers = [...new Set([wish.reserved_by, ...results.map((r) => r.user_id)])].filter((id) => id !== data.me.id);
  notifyLater(context, givers, {
    title: `${data.me.name} te dit merci`,
    body: `Pour « ${wish.title} ».`,
    url: '/#/cadeaux',
    tag: `merci-${wish.id}`,
  });
  return json({ ok: true });
}
