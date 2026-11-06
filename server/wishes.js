/**
 * Règle de secret, au même endroit pour toute l'app :
 * - pour soi-même : uniquement ses propres envies, sans aucune info de réservation ;
 * - pour quelqu'un d'autre : tout, avec qui a réservé, qui participe et les idées secrètes.
 */
export async function visibleWishes(db, ownerId, viewerId) {
  if (ownerId === viewerId) {
    const { results } = await db
      .prepare(
        `SELECT id, title, url, price, note, favorite, photo IS NOT NULL AS has_photo, created_at
         FROM wishes WHERE owner_id = ?1 AND added_by = ?1
         ORDER BY favorite DESC, created_at DESC`,
      )
      .bind(ownerId)
      .all();
    return results.map((w) => ({ ...w, favorite: !!w.favorite, mine: true, can_edit: true }));
  }

  const { results } = await db
    .prepare(
      `SELECT w.id, w.title, w.url, w.price, w.note, w.favorite, w.photo IS NOT NULL AS has_photo, w.created_at,
              w.added_by, a.name AS added_by_name,
              w.reserved_by, r.name AS reserved_by_name, w.group_gift, w.bought,
              (SELECT json_group_array(json_object('id', u.id, 'name', u.name))
                 FROM contributions c JOIN users u ON u.id = c.user_id
                 WHERE c.wish_id = w.id) AS participants
       FROM wishes w
       JOIN users a ON a.id = w.added_by
       LEFT JOIN users r ON r.id = w.reserved_by
       WHERE w.owner_id = ?1
       ORDER BY w.favorite DESC, w.created_at DESC`,
    )
    .bind(ownerId)
    .all();

  return results.map((w) => {
    const participants = JSON.parse(w.participants || '[]');
    return {
      id: w.id,
      title: w.title,
      url: w.url,
      price: w.price,
      note: w.note,
      favorite: !!w.favorite,
      has_photo: w.has_photo,
      created_at: w.created_at,
      secret: w.added_by !== ownerId,
      added_by_name: w.added_by_name,
      can_delete: w.added_by === viewerId,
      can_edit: w.added_by === viewerId,
      reserved: w.reserved_by !== null,
      reserved_by_me: w.reserved_by === viewerId,
      reserved_by_name: w.reserved_by_name,
      group_gift: !!w.group_gift,
      participants,
      participating: participants.some((p) => p.id === viewerId),
      bought: !!w.bought,
    };
  });
}

// Lit un prix saisi à la main (« ≈ 30 € », « 24,90 », « 20-40 € ») : on garde le premier nombre.
export function priceValue(text) {
  const match = String(text || '').replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}
