// Journal d'erreurs : ce que la famille a vu planter (navigateur) et ce qui a planté côté serveur.
// Plafonné, pour qu'une boucle d'erreurs ne remplisse jamais la base. Consultation : npm run errors.
const MAX_PER_DAY = 300;
const MAX_PER_USER_PER_HOUR = 20;

const cut = (value, max) => String(value ?? '').slice(0, max);

export async function logError(db, { source, userId = null, message, detail = '', page = '', userAgent = '' }) {
  const counts = await db
    .prepare(
      `SELECT COUNT(*) AS day,
              SUM(user_id IS ?1 AND created_at >= datetime('now', '-1 hour')) AS mine
       FROM error_log WHERE created_at >= datetime('now', '-1 day')`,
    )
    .bind(userId)
    .first();
  if (counts.day >= MAX_PER_DAY || (userId && (counts.mine || 0) >= MAX_PER_USER_PER_HOUR)) return false;
  await db
    .prepare(
      'INSERT INTO error_log (source, user_id, message, detail, page, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    )
    .bind(
      source,
      userId,
      cut(message, 500) || 'Erreur sans message',
      cut(detail, 4000),
      cut(page, 300),
      cut(userAgent, 300),
    )
    .run();
  return true;
}

// Ménage : on garde 60 jours d'erreurs.
export const pruneErrors = (db) =>
  db.prepare("DELETE FROM error_log WHERE created_at < datetime('now', '-60 days')").run();
