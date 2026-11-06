// Une base D1 en mémoire pour les tests : SQLite de Node, avec la même interface que D1
// (prepare().bind().first() / all() / run(), batch). Le schéma et les migrations sont ceux du projet.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);

export function testDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('schema.sql', root), 'utf8'));
  const applied = new Set(
    sqlite
      .prepare('SELECT name FROM d1_migrations')
      .all()
      .map((r) => r.name),
  );
  for (const name of readdirSync(new URL('migrations/', root))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    if (!applied.has(name)) sqlite.exec(readFileSync(new URL(`migrations/${name}`, root), 'utf8'));
  }

  // D1 renvoie null quand il n'y a pas de ligne, et des objets simples.
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => {
      const row = sqlite.prepare(sql).get(...params);
      return row ? { ...row } : null;
    },
    all: async () => ({
      results: sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row })),
    }),
    run: async () => {
      const result = sqlite.prepare(sql).run(...params);
      return { meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
    },
  });
  const prepare = (sql) => statement(sql);

  return {
    sqlite,
    prepare,
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const st of statements) results.push(await st.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

// Petits raccourcis pour remplir la base.
export function seed(db) {
  const run = (sql, ...params) => db.sqlite.prepare(sql).run(...params);
  return {
    user: (name, extra = {}) =>
      Number(
        run(
          'INSERT INTO users (email, name, birthday) VALUES (?, ?, ?)',
          `${name.toLowerCase()}@test.fr`,
          name,
          extra.birthday ?? null,
        ).lastInsertRowid,
      ),
    family: (name, ...members) => {
      const id = Number(run('INSERT INTO families (name, code) VALUES (?, ?)', name, `CODE-${name}`).lastInsertRowid);
      for (const member of members) run('INSERT INTO memberships (family_id, user_id) VALUES (?, ?)', id, member);
      return id;
    },
    wish: (owner, title, extra = {}) =>
      Number(
        run(
          `INSERT INTO wishes (owner_id, added_by, family_id, title, price, reserved_by, group_gift, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          owner,
          extra.addedBy ?? owner,
          extra.family ?? null,
          title,
          extra.price ?? null,
          extra.reservedBy ?? null,
          extra.group ? 1 : 0,
          extra.receivedAt ?? null,
        ).lastInsertRowid,
      ),
    contribute: (wish, user, amount = null) =>
      run('INSERT INTO contributions (wish_id, user_id, amount) VALUES (?, ?, ?)', wish, user, amount),
  };
}

// Appelle une route Pages Functions comme le ferait le middleware, et lit sa réponse JSON.
export async function call(handler, { db, me, family, params = {}, url = 'https://test/api', body, env = {} }) {
  const request = new Request(url, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  const response = await handler({
    request,
    env: { DB: db, ...env },
    params,
    data: { me: typeof me === 'object' ? me : { id: me }, family: family ? { id: family } : null },
  });
  return {
    status: response.status,
    body: response.headers.get('content-type')?.includes('ndjson') ? await response.text() : await response.json(),
  };
}
