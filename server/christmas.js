// Après Noël : le récap « qui t'a offert quoi », révélé du 26 décembre au 31 janvier.
// Seuls les cadeaux réservés pour Noël (l'occasion choisie par celui qui offre) et passés « Offert »
// (ou « Reçu ») de novembre à janvier comptent : une réservation pour un anniversaire reste secrète.

// L'année du Noël à révéler, ou null hors de la période.
export function recapYear(now = new Date()) {
  const month = now.getUTCMonth() + 1;
  if (month === 12 && now.getUTCDate() >= 26) return now.getUTCFullYear();
  if (month === 1) return now.getUTCFullYear() - 1;
  return null;
}

const names = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} et ${list.at(-1)}` : list[0] || '');

export async function christmasRecap(db, userId, now = new Date()) {
  const year = recapYear(now);
  if (!year) return null;
  const { results } = await db
    .prepare(
      `SELECT w.id, w.title, w.group_gift, w.added_by != w.owner_id AS secret, r.name AS giver, w.thanked_at,
              (SELECT json_group_array(name) FROM (SELECT u.name FROM contributions c JOIN users u ON u.id = c.user_id
                WHERE c.wish_id = w.id AND u.name IS NOT NULL ORDER BY c.created_at, c.rowid)) AS participants
       FROM wishes w LEFT JOIN users r ON r.id = w.reserved_by
       WHERE w.owner_id = ?1 AND w.reserved_by IS NOT NULL AND COALESCE(w.occasion, 'christmas') = 'christmas'
         AND w.received_at >= ?2 AND w.received_at < ?3
       ORDER BY w.received_at`,
    )
    .bind(userId, `${year}-11-01`, `${year + 1}-02-01`)
    .all();
  return {
    year,
    gifts: results.map((g) => {
      const group = g.group_gift ? JSON.parse(g.participants || '[]') : [];
      return {
        id: g.id,
        title: g.title,
        from: names(group.length ? group : [g.giver].filter(Boolean)),
        secret: !!g.secret,
        thanked: !!g.thanked_at,
      };
    }),
  };
}

// Le 26 décembre au matin : ce qu'on avait réservé et pas encore marqué « Offert ».
export async function unfinishedGifts(db, userId) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n, SUM(bought) AS bought FROM wishes
       WHERE reserved_by = ?1 AND received_at IS NULL AND removed_at IS NULL
         AND COALESCE(occasion, 'christmas') = 'christmas'`,
    )
    .bind(userId)
    .first();
  return { count: row.n || 0, bought: row.bought || 0 };
}
