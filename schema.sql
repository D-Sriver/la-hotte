-- La Hotte : schéma D1 (SQLite)
-- Cloudflare Access laisse entrer tout le monde (code par email) ;
-- on fait partie de la famille une fois le code familial saisi (joined = 1).

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,                 -- NULL tant que le profil n'est pas rempli
  likes       TEXT DEFAULT '',      -- ce qu'il/elle aime, centres d'intérêt
  dislikes    TEXT DEFAULT '',      -- à éviter
  owns        TEXT DEFAULT '',      -- ce qu'il/elle a déjà (évite les doublons)
  sizes       TEXT DEFAULT '',      -- tailles, pointures...
  budget_hint TEXT DEFAULT '',      -- ex. "20-50 €"
  joined      INTEGER NOT NULL DEFAULT 0, -- 1 quand le code familial a été saisi
  join_failures INTEGER NOT NULL DEFAULT 0, -- mauvais codes, pour bloquer le devinage
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Une envie / idée cadeau pour une personne.
-- Si added_by != owner_id, c'est une idée secrète : le propriétaire ne la voit jamais.
CREATE TABLE IF NOT EXISTS wishes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT,
  price       TEXT,
  note        TEXT DEFAULT '',
  photo       TEXT,                 -- image JPEG en data URL, réduite côté navigateur
  favorite    INTEGER NOT NULL DEFAULT 0, -- coup de cœur du propriétaire
  reserved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- celui qui offre, ou qui organise si group_gift
  reserved_at TEXT,
  group_gift  INTEGER NOT NULL DEFAULT 0, -- cadeau à plusieurs : les participants sont dans contributions
  bought      INTEGER NOT NULL DEFAULT 0, -- acheté (jamais montré au propriétaire)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wishes_owner ON wishes(owner_id);

-- Participants d'un cadeau à plusieurs (l'organisateur compris).
CREATE TABLE IF NOT EXISTS contributions (
  wish_id    INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (wish_id, user_id)
);

-- Compteur pour limiter les recherches IA (coût de l'API).
CREATE TABLE IF NOT EXISTS idea_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_idea_requests_user ON idea_requests(user_id, created_at);
