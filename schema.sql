-- La Hotte : schéma D1 (SQLite)
-- Cloudflare Access laisse entrer tout le monde (code par email) ;
-- on voit les autres une fois qu'on a créé ou rejoint une famille (memberships).

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,                 -- NULL tant que le profil n'est pas rempli
  likes       TEXT DEFAULT '',      -- ce qu'il/elle aime, centres d'intérêt
  dislikes    TEXT DEFAULT '',      -- à éviter
  owns        TEXT DEFAULT '',      -- ce qu'il/elle a déjà (évite les doublons)
  sizes       TEXT DEFAULT '',      -- tailles, pointures...
  budget_hint TEXT DEFAULT '',      -- ex. "20-50 €"
  joined      INTEGER NOT NULL DEFAULT 0, -- ancien code familial unique, plus utilisé
  join_failures INTEGER NOT NULL DEFAULT 0, -- mauvais codes, pour bloquer le devinage
  join_failed_at TEXT,                  -- dernier mauvais code (blocage levé au bout d'une heure)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Une famille : un nom et un code à partager. Une personne peut être dans plusieurs familles.
CREATE TABLE IF NOT EXISTS families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
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

-- Une envie / idée cadeau pour une personne.
-- Si added_by != owner_id, c'est une idée secrète : le propriétaire ne la voit jamais.
CREATE TABLE IF NOT EXISTS wishes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   INTEGER REFERENCES families(id) ON DELETE CASCADE, -- NULL : envie à soi ; sinon famille de l'idée secrète
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
  amount     REAL,                 -- ce que la personne met, en euros (NULL = pas encore précisé)
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

-- Compteur des recherches de prix SerpApi (palier gratuit : on s'arrête bien avant la limite).
CREATE TABLE IF NOT EXISTS price_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
