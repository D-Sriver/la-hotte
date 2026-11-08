// Sauvegarde de toute la base, chaque nuit, dans KV (gratuit) : un JSON par jour, gardé 30 jours.
// En plus du « Time Travel » de D1 (retour en arrière intégré), au cas où la base elle-même serait perdue.
// Restauration : npm run backup:restore -- AAAA-MM-JJ (voir scripts/restore-backup.mjs).
const KEEP_DAYS = 30;
const MAX_BYTES = 24 * 1024 * 1024; // une valeur KV ne dépasse pas 25 Mo

export const backupKey = (date) => `backup-${date.toISOString().slice(0, 10)}`;

export async function backupDatabase(env, now = new Date()) {
  if (!env.BACKUPS) return null;
  const db = env.DB;
  const { results: tables } = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`,
    )
    .all();
  const dump = { created_at: now.toISOString(), tables: {} };
  for (const { name } of tables) {
    dump.tables[name] = (await db.prepare(`SELECT * FROM "${name}"`).all()).results;
  }
  const body = JSON.stringify(dump);
  if (body.length > MAX_BYTES) throw new Error(`Sauvegarde trop grosse pour KV : ${body.length} octets`);
  const rows = Object.values(dump.tables).reduce((n, list) => n + list.length, 0);
  await env.BACKUPS.put(backupKey(now), body, {
    expirationTtl: KEEP_DAYS * 86_400,
    metadata: { bytes: body.length, rows },
  });
  return { key: backupKey(now), bytes: body.length, rows };
}
