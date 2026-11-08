// Prépare la restauration d'une sauvegarde nocturne (KV) en fichier SQL, sans rien toucher à la base.
//   npm run backup:list                    → les sauvegardes disponibles
//   npm run backup:restore -- 2026-12-24   → écrit backups/restore-2026-12-24.sql
// Puis, après relecture : npx wrangler d1 execute la-hotte --remote --file=backups/restore-2026-12-24.sql
// Ce fichier REMPLACE tout le contenu de la base par celui de la sauvegarde.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const NAMESPACE = 'b95046d8443046fc92131272233900cb';
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.error('Donne la date de la sauvegarde : npm run backup:restore -- AAAA-MM-JJ');
  process.exit(1);
}

const raw = execFileSync(
  'npx',
  ['wrangler', 'kv', 'key', 'get', `backup-${date}`, `--namespace-id=${NAMESPACE}`, '--remote', '--text'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const dump = JSON.parse(raw);

const literal = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

// d1_migrations reste celle de la base actuelle : le schéma ne change pas, seules les données reviennent.
const tables = Object.keys(dump.tables).filter((name) => name !== 'd1_migrations');
const lines = ['PRAGMA defer_foreign_keys = true;'];
for (const name of tables) lines.push(`DELETE FROM "${name}";`);
for (const name of tables) {
  for (const row of dump.tables[name]) {
    const columns = Object.keys(row);
    lines.push(
      `INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((c) => literal(row[c])).join(', ')});`,
    );
  }
}

mkdirSync('backups', { recursive: true });
const file = `backups/restore-${date}.sql`;
writeFileSync(file, `${lines.join('\n')}\n`);
const rows = tables.reduce((n, name) => n + dump.tables[name].length, 0);
console.log(`Sauvegarde du ${dump.created_at} : ${rows} lignes dans ${tables.length} tables → ${file}`);
console.log(`Pour restaurer (remplace toute la base) : npx wrangler d1 execute la-hotte --remote --file=${file}`);
