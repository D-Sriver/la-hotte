// Tableau de bord de l'administrateur : des chiffres d'ensemble, jamais qui offre quoi à qui.
const one = async (db, sql, ...values) =>
  (await db
    .prepare(sql)
    .bind(...values)
    .first()) || {};
const all = async (db, sql, ...values) =>
  (
    await db
      .prepare(sql)
      .bind(...values)
      .all()
  ).results;

export async function adminStats(env) {
  const db = env.DB;
  const [people, wishes, push, ai, prices, watch, errors] = await Promise.all([
    one(
      db,
      `SELECT COUNT(*) AS total,
              SUM(last_seen_at >= datetime('now', '-7 days')) AS active_7d,
              SUM(last_seen_at >= datetime('now', '-30 days')) AS active_30d
       FROM users WHERE name IS NOT NULL`,
    ),
    one(
      db,
      `SELECT SUM(received_at IS NULL AND removed_at IS NULL) AS open,
              SUM(received_at IS NULL AND removed_at IS NULL AND reserved_by IS NOT NULL) AS reserved,
              SUM(received_at IS NULL AND removed_at IS NULL AND group_gift = 1) AS pots,
              SUM(received_at >= strftime('%Y-01-01', 'now')) AS given_this_year,
              SUM(added_by != owner_id AND received_at IS NULL AND removed_at IS NULL) AS secret_ideas
       FROM wishes`,
    ),
    one(db, 'SELECT COUNT(*) AS devices, COUNT(DISTINCT user_id) AS people FROM push_subscriptions'),
    one(
      db,
      `SELECT SUM(created_at >= date('now')) AS today,
              SUM(created_at >= datetime('now', 'start of month')) AS month
       FROM idea_requests`,
    ),
    one(db, "SELECT COUNT(*) AS month FROM price_searches WHERE created_at >= datetime('now', 'start of month')"),
    one(
      db,
      `SELECT SUM(last_price IS NOT NULL) AS tracked, SUM(last_price IS NULL) AS untracked,
              SUM(source = 'shopping') AS shopping, SUM(alerted_at_price IS NOT NULL) AS drops
       FROM price_watch`,
    ),
    one(
      db,
      `SELECT SUM(created_at >= datetime('now', '-1 day')) AS day,
              SUM(created_at >= datetime('now', '-7 days')) AS week
       FROM error_log`,
    ),
  ]);

  const families = await all(
    db,
    `SELECT f.name,
            (SELECT COUNT(*) FROM memberships m WHERE m.family_id = f.id) AS members,
            (SELECT COUNT(*) FROM wishes w JOIN memberships m ON m.user_id = w.owner_id AND m.family_id = f.id
              WHERE w.received_at IS NULL AND w.removed_at IS NULL AND (w.family_id IS NULL OR w.family_id = f.id)) AS wishes
     FROM families f ORDER BY members DESC, f.name`,
  );
  const recentErrors = await all(
    db,
    `SELECT message, source, COUNT(*) AS count, MAX(created_at) AS last
     FROM error_log WHERE created_at >= datetime('now', '-7 days')
     GROUP BY message, source ORDER BY last DESC LIMIT 8`,
  );

  // Dernière sauvegarde de la nuit (KV), si le site y a accès.
  let backup = null;
  if (env.BACKUPS) {
    const { keys } = await env.BACKUPS.list({ prefix: 'backup-' });
    const last = keys.sort((a, b) => a.name.localeCompare(b.name)).at(-1);
    if (last)
      backup = {
        date: last.name.slice(7),
        rows: last.metadata?.rows ?? null,
        bytes: last.metadata?.bytes ?? null,
        count: keys.length,
      };
  }

  return {
    people,
    families,
    wishes,
    push,
    quotas: {
      ideas_today: ai.today || 0,
      ideas_month: ai.month || 0,
      ideas_per_day_per_person: Number(env.IDEAS_PER_DAY || 20),
      price_searches_month: prices.month || 0,
      price_searches_limit: Number(env.PRICE_SEARCHES_PER_MONTH) || 200,
    },
    watch,
    errors: { ...errors, recent: recentErrors },
    backup,
  };
}
