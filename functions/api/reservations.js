import { json } from '../../server/http.js';
import { priceValue } from '../../server/wishes.js';

// Tout ce que je prévois d'offrir, seul ou à plusieurs, avec ma part du budget.
export async function onRequestGet({ env, data }) {
  const { results } = await env.DB.prepare(
    `SELECT w.id, w.title, w.url, w.price, w.bought, w.group_gift, (SELECT json_object('id', id, 'frame', frame) FROM wish_photos WHERE wish_id = w.id ORDER BY position, id LIMIT 1) AS cover,
            o.id AS owner_id, o.name AS owner_name,
            (SELECT COUNT(*) FROM contributions c WHERE c.wish_id = w.id) AS participant_count,
            (SELECT amount FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1) AS my_amount
     FROM wishes w JOIN users o ON o.id = w.owner_id
     WHERE w.owner_id != ?1 AND w.received_at IS NULL AND (
       (w.reserved_by = ?1 AND w.group_gift = 0)
       OR (w.group_gift = 1 AND EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1))
     )
     ORDER BY o.name COLLATE NOCASE, w.created_at`,
  )
    .bind(data.me.id)
    .all();

  const gifts = results.map((w) => {
    const value = priceValue(w.price);
    const share = w.group_gift ? Math.max(1, w.participant_count) : 1;
    // À plusieurs : le montant que j'ai annoncé, sinon une part égale.
    const myShare = w.group_gift && w.my_amount ? w.my_amount : value === null ? null : value / share;
    return {
      id: w.id,
      title: w.title,
      url: w.url,
      price: w.price,
      cover: w.cover ? JSON.parse(w.cover) : null,
      owner_id: w.owner_id,
      owner_name: w.owner_name,
      bought: !!w.bought,
      group_gift: !!w.group_gift,
      participant_count: w.participant_count,
      my_share: myShare === null ? null : Math.round(myShare * 100) / 100,
      my_amount_set: !!(w.group_gift && w.my_amount),
    };
  });
  const total = gifts.reduce((sum, g) => sum + (g.my_share || 0), 0);
  return json({ gifts, total: Math.round(total * 100) / 100, unpriced: gifts.filter((g) => g.my_share === null).length });
}
