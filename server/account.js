// Mes données (RGPD) : tout ce que La Hotte garde de moi, et la suppression de mon compte.
// L'export ne contient jamais ce qui m'est caché : ni qui m'offre quoi, ni les idées secrètes des autres pour moi.

const all = async (db, sql, ...values) =>
  (
    await db
      .prepare(sql)
      .bind(...values)
      .all()
  ).results;

export async function exportMyData(db, userId) {
  const profile = await db
    .prepare(
      `SELECT email, name, likes, dislikes, owns, sizes, budget_hint, birthday, created_at,
              notify_email, notify_messages, notify_groups, notify_prices
       FROM users WHERE id = ?1`,
    )
    .bind(userId)
    .first();
  return {
    exported_at: new Date().toISOString(),
    profile,
    families: await all(
      db,
      `SELECT f.name, f.code, m.joined_at FROM memberships m JOIN families f ON f.id = m.family_id WHERE m.user_id = ?1`,
      userId,
    ),
    my_wishes: await all(
      db,
      `SELECT title, url, price, note, favorite, created_at, received_at FROM wishes
       WHERE owner_id = ?1 AND added_by = ?1 ORDER BY created_at`,
      userId,
    ),
    ideas_i_added_for_others: await all(
      db,
      `SELECT o.name AS for_person, w.title, w.url, w.price, w.note, w.created_at
       FROM wishes w JOIN users o ON o.id = w.owner_id WHERE w.added_by = ?1 AND w.owner_id != ?1`,
      userId,
    ),
    gifts_i_give: await all(
      db,
      `SELECT o.name AS for_person, w.title, w.price, w.group_gift, w.bought, w.occasion, w.received_at,
              (SELECT amount FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1) AS my_amount
       FROM wishes w JOIN users o ON o.id = w.owner_id
       WHERE w.reserved_by = ?1 OR EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1)`,
      userId,
    ),
    my_budgets: await all(
      db,
      `SELECT u.name AS for_person, b.amount FROM gift_budgets b JOIN users u ON u.id = b.person_id WHERE b.user_id = ?1`,
      userId,
    ),
    messages_i_wrote: await all(
      db,
      `SELECT w.title AS about, m.body, m.created_at FROM wish_messages m JOIN wishes w ON w.id = m.wish_id
       WHERE m.user_id = ?1 ORDER BY m.created_at`,
      userId,
    ),
  };
}

// Supprimer mon compte. Avant d'effacer : les cagnottes que j'organise passent au plus ancien participant
// (sinon elles se rouvrent), pour que la famille ne se retrouve pas avec un cadeau sans organisateur.
export async function deleteAccount(db, userId) {
  const { results: pots } = await db
    .prepare('SELECT id FROM wishes WHERE reserved_by = ?1 AND group_gift = 1 AND owner_id != ?1')
    .bind(userId)
    .all();
  const steps = [];
  for (const { id } of pots) {
    const next = await db
      .prepare(
        'SELECT user_id FROM contributions WHERE wish_id = ?1 AND user_id != ?2 ORDER BY created_at, rowid LIMIT 1',
      )
      .bind(id, userId)
      .first();
    steps.push(
      next
        ? db.prepare('UPDATE wishes SET reserved_by = ?2 WHERE id = ?1').bind(id, next.user_id)
        : db
            .prepare(
              'UPDATE wishes SET reserved_by = NULL, reserved_at = NULL, group_gift = 0, bought = 0, occasion = NULL WHERE id = ?1',
            )
            .bind(id),
    );
  }
  // Mes réservations seules se libèrent (la famille peut les reprendre), sans suivi de prix orphelin.
  steps.push(
    db
      .prepare(
        `DELETE FROM price_watch WHERE wish_id IN (SELECT id FROM wishes WHERE reserved_by = ?1 AND group_gift = 0)`,
      )
      .bind(userId),
    db
      .prepare(
        'UPDATE wishes SET reserved_by = NULL, reserved_at = NULL, bought = 0, occasion = NULL WHERE reserved_by = ?1 AND group_gift = 0',
      )
      .bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?1').bind(userId),
  );
  await db.batch(steps);
}
