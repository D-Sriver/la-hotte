/**
 * Règle de secret, au même endroit pour toute l'app :
 * - pour soi-même : uniquement ses propres envies, sans aucune info de réservation ;
 * - pour quelqu'un d'autre : tout, avec qui a réservé et les idées secrètes.
 */
export async function visibleWishes(db, ownerId, viewerId) {
  if (ownerId === viewerId) {
    const { results } = await db
      .prepare(
        `SELECT id, title, url, price, note, created_at
         FROM wishes WHERE owner_id = ?1 AND added_by = ?1
         ORDER BY created_at DESC`,
      )
      .bind(ownerId)
      .all();
    return results.map((w) => ({ ...w, mine: true }));
  }

  const { results } = await db
    .prepare(
      `SELECT w.id, w.title, w.url, w.price, w.note, w.created_at,
              w.added_by, a.name AS added_by_name,
              w.reserved_by, r.name AS reserved_by_name
       FROM wishes w
       JOIN users a ON a.id = w.added_by
       LEFT JOIN users r ON r.id = w.reserved_by
       WHERE w.owner_id = ?1
       ORDER BY w.created_at DESC`,
    )
    .bind(ownerId)
    .all();

  return results.map((w) => ({
    id: w.id,
    title: w.title,
    url: w.url,
    price: w.price,
    note: w.note,
    created_at: w.created_at,
    secret: w.added_by !== ownerId,
    added_by_name: w.added_by_name,
    can_delete: w.added_by === viewerId,
    reserved: w.reserved_by !== null,
    reserved_by_me: w.reserved_by === viewerId,
    reserved_by_name: w.reserved_by_name,
  }));
}
