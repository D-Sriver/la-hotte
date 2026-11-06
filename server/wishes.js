import { PHOTOS_JSON, parsePhotos } from './photos.js';

/**
 * Règle de secret, au même endroit pour toute l'app :
 * - pour soi-même : uniquement ses propres envies, sans aucune info de réservation ;
 * - pour quelqu'un d'autre, dans la famille affichée : ses envies, les idées secrètes de cette famille,
 *   qui a réservé et qui participe. Les réservations se voient d'une famille à l'autre (pas de doublon),
 *   mais le nom n'est donné qu'aux membres de la même famille.
 */
export async function visibleWishes(db, ownerId, viewerId, familyId, { archived = false } = {}) {
  // Les cadeaux reçus quittent les listes : on ne les voit plus que dans les archives de leur propriétaire.
  const receivedFilter = archived ? 'received_at IS NOT NULL' : 'received_at IS NULL';
  if (ownerId === viewerId) {
    const { results } = await db
      .prepare(
        `SELECT w.id, w.title, w.url, w.price, w.note, w.favorite, ${PHOTOS_JSON} AS photos, w.created_at, w.received_at
         FROM wishes w WHERE w.owner_id = ?1 AND w.added_by = ?1 AND w.family_id IS NULL AND w.removed_at IS NULL
           AND w.${receivedFilter}
         ORDER BY ${archived ? 'w.received_at DESC' : 'w.favorite DESC, w.created_at DESC'}`,
      )
      .bind(ownerId)
      .all();
    return results.map((w) => ({ ...w, photos: parsePhotos(w.photos), favorite: !!w.favorite, mine: true, can_edit: true }));
  }

  const { results } = await db
    .prepare(
      `SELECT w.id, w.title, w.url, w.price, w.note, w.favorite, ${PHOTOS_JSON} AS photos, w.created_at,
              w.added_by, a.name AS added_by_name,
              w.reserved_by, CASE WHEN rm.user_id IS NULL THEN NULL ELSE r.name END AS reserved_by_name,
              w.group_gift, w.bought, w.removed_at, w.reserved_at,
              CASE WHEN w.edited_at > w.reserved_at THEN 1 ELSE 0 END AS edited_after_reservation,
              (SELECT json_group_array(json_object(
                        'id', u.id,
                        'name', CASE WHEN EXISTS (SELECT 1 FROM memberships pm WHERE pm.family_id = ?2 AND pm.user_id = u.id)
                                     THEN u.name ELSE NULL END,
                        'amount', c.amount))
                 FROM contributions c JOIN users u ON u.id = c.user_id
                 WHERE c.wish_id = w.id) AS participants,
              (SELECT COUNT(*) FROM wish_messages wm WHERE wm.wish_id = w.id AND wm.family_id = ?2) AS message_count
       FROM wishes w
       JOIN users a ON a.id = w.added_by
       LEFT JOIN users r ON r.id = w.reserved_by
       LEFT JOIN memberships rm ON rm.user_id = w.reserved_by AND rm.family_id = ?2
       WHERE w.owner_id = ?1 AND (w.family_id IS NULL OR w.family_id = ?2) AND w.received_at IS NULL
         AND (w.removed_at IS NULL OR w.reserved_by = ?3
           OR EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?3))
       ORDER BY w.favorite DESC, w.created_at DESC`,
    )
    .bind(ownerId, familyId, viewerId)
    .all();

  return results.map((w) => {
    const participants = JSON.parse(w.participants || '[]')
      .map((p) => ({ ...p, name: p.name || 'Autre famille' }));
    const mine = participants.find((p) => p.id === viewerId);
    return {
      id: w.id,
      title: w.title,
      url: w.url,
      price: w.price,
      note: w.note,
      favorite: !!w.favorite,
      photos: parsePhotos(w.photos),
      created_at: w.created_at,
      secret: w.added_by !== ownerId,
      added_by_name: w.added_by_name,
      can_delete: w.added_by === viewerId,
      can_edit: w.added_by === viewerId,
      reserved: w.reserved_by !== null,
      reserved_by_me: w.reserved_by === viewerId,
      reserved_by_name: w.reserved_by_name || 'quelqu’un d’une autre famille',
      group_gift: !!w.group_gift,
      participants,
      participating: !!mine,
      my_amount: mine?.amount ?? null,
      collected: participants.reduce((sum, p) => sum + (p.amount || 0), 0),
      target: priceValue(w.price),
      bought: !!w.bought,
      message_count: w.message_count,
      // Le propriétaire l'a retirée de sa liste, ou l'a changée, après la réservation.
      removed: !!w.removed_at,
      edited_after_reservation: !!w.edited_after_reservation && w.reserved_by !== null,
    };
  });
}

// Lit un prix saisi à la main (« ≈ 30 € », « 24,90 », « 20-40 € ») : on garde le premier nombre.
export function priceValue(text) {
  const match = String(text || '').replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

// La personne fait-elle partie de la famille affichée ? (sinon on ne montre ni elle ni sa liste)
export async function personInFamily(db, personId, familyId) {
  return db.prepare(
    `SELECT u.id, u.name, u.likes, u.dislikes, u.owns, u.sizes, u.budget_hint, substr(u.birthday, 6) AS birthday
     FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE u.id = ?1 AND m.family_id = ?2 AND u.name IS NOT NULL`,
  )
    .bind(personId, familyId)
    .first();
}

// Peut-on agir sur ce vœu depuis la famille affichée ? Il faut voir la personne, et l'idée doit être de cette famille.
export async function wishInFamily(db, wishId, familyId) {
  return db.prepare(
    `SELECT w.* FROM wishes w JOIN memberships m ON m.user_id = w.owner_id AND m.family_id = ?2
     WHERE w.id = ?1 AND (w.family_id IS NULL OR w.family_id = ?2)`,
  )
    .bind(wishId, familyId)
    .first();
}
