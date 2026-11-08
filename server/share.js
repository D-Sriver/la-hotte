// Liste partagée hors de la famille, en lecture seule : ce que la personne a mis sur sa liste,
// sans aucune réservation (elle pourrait ouvrir le lien elle-même) ni idée secrète.
export async function sharedList(db, token) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token || '')) return null;
  const owner = await db
    .prepare('SELECT id, name FROM users WHERE share_token = ?1 AND name IS NOT NULL')
    .bind(token)
    .first();
  if (!owner) return null;
  const { results } = await db
    .prepare(
      `SELECT w.id, w.title, w.url, w.price, w.note, w.favorite,
              (SELECT p.id FROM wish_photos p WHERE p.wish_id = w.id ORDER BY p.position, p.id LIMIT 1) AS photo_id
       FROM wishes w
       WHERE w.owner_id = ?1 AND w.added_by = ?1 AND w.family_id IS NULL
         AND w.received_at IS NULL AND w.removed_at IS NULL
       ORDER BY w.favorite DESC, w.created_at DESC`,
    )
    .bind(owner.id)
    .all();
  return { owner, wishes: results };
}

// La photo d'une envie de cette liste (et seulement de celle-ci).
export async function sharedPhoto(db, token, photoId) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token || '')) return null;
  return db
    .prepare(
      `SELECT p.photo FROM wish_photos p
       JOIN wishes w ON w.id = p.wish_id
       JOIN users u ON u.id = w.owner_id AND u.share_token = ?1
       WHERE p.id = ?2 AND w.added_by = w.owner_id AND w.family_id IS NULL
         AND w.received_at IS NULL AND w.removed_at IS NULL`,
    )
    .bind(token, photoId)
    .first();
}
