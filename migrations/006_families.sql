-- Plusieurs familles, chacune avec son code. À lancer une fois (npm run db:migrate:families).
CREATE TABLE IF NOT EXISTS families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,  -- ex. K7PQ-M3XA, à partager pour rejoindre
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (family_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- NULL pour ses propres envies (visibles dans toutes ses familles),
-- sinon la famille où l'idée secrète a été ajoutée.
ALTER TABLE wishes ADD COLUMN family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;
-- Pour débloquer les essais de code au bout d'une heure.
ALTER TABLE users ADD COLUMN join_failed_at TEXT;
