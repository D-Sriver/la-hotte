import { json } from '../../server/http.js';
import { priceValue } from '../../server/wishes.js';

// « tracked » : le prix est relu chaque matin ; « drop » : il a baissé depuis la première lecture.
function watchState(w) {
  const drop = w.first_price && w.last_price && w.last_price < w.first_price - 0.005;
  return { tracked: w.last_price !== null, first: w.first_price, last: w.last_price, drop: !!drop };
}

// Tout ce que je prévois d'offrir, seul ou à plusieurs, avec ma part du budget ;
// plus ce que j'ai déjà offert cette année (reçu), pour le bilan de l'année par personne.
export async function onRequestGet({ env, data }) {
  const { results } = await env.DB.prepare(
    `SELECT w.id, w.title, w.url, w.price, w.bought, w.group_gift, w.reserved_by, w.removed_at, (SELECT json_object('id', id, 'frame', frame) FROM wish_photos WHERE wish_id = w.id ORDER BY position, id LIMIT 1) AS cover,
            o.id AS owner_id, o.name AS owner_name,
            (SELECT json_group_array(m1.family_id) FROM memberships m1
               JOIN memberships m2 ON m2.family_id = m1.family_id AND m2.user_id = ?1
             WHERE m1.user_id = o.id) AS families,
            (SELECT COUNT(*) FROM contributions c WHERE c.wish_id = w.id) AS participant_count,
            (SELECT amount FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1) AS my_amount,
            w.received_at, w.occasion, w.thanked_at, pw.wish_id AS watched, pw.first_price, pw.last_price
     FROM wishes w JOIN users o ON o.id = w.owner_id
     LEFT JOIN price_watch pw ON pw.wish_id = w.id
     WHERE w.owner_id != ?1
       AND (w.received_at IS NULL OR w.received_at >= strftime('%Y-01-01', 'now'))
       AND (
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
      families: JSON.parse(w.families || '[]'), // familles où je peux ouvrir sa page
      bought: !!w.bought,
      group_gift: !!w.group_gift,
      participant_count: w.participant_count,
      my_share: myShare === null ? null : Math.round(myShare * 100) / 100,
      my_amount_set: !!(w.group_gift && w.my_amount),
      received: !!w.received_at,
      // À plusieurs, seul l'organisateur achète.
      i_buy: w.reserved_by === data.me.id,
      removed: !!w.removed_at,
      occasion: w.occasion || 'christmas',
      thanked: !!w.thanked_at,
      // Suivi des prix (pour celui qui achète) : null tant que la page n'a pas été relue.
      price_watch:
        w.reserved_by === data.me.id && w.url && !w.bought && !w.received_at && w.watched ? watchState(w) : null,
    };
  });
  // Mes budgets par personne (privés).
  const { results: budgetRows } = await env.DB.prepare('SELECT person_id, amount FROM gift_budgets WHERE user_id = ?1')
    .bind(data.me.id)
    .all();
  const budgets = Object.fromEntries(budgetRows.map((b) => [b.person_id, b.amount]));
  const sum = (list) => Math.round(list.reduce((total, g) => total + (g.my_share || 0), 0) * 100) / 100;
  const planned = gifts.filter((g) => !g.received);
  return json({
    gifts: planned,
    given: gifts.filter((g) => g.received),
    total: sum(planned),
    year_total: sum(gifts),
    unpriced: planned.filter((g) => g.my_share === null).length,
    budgets,
  });
}
