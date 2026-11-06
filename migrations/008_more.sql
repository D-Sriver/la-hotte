-- Limites par famille, discussion secrète, reçu/archives, anniversaires, connexion par email, rappels.
-- À lancer une fois (npm run db:migrate:more).

-- Limites par famille : on sait pour quelle famille chaque recherche a été faite.
ALTER TABLE idea_requests ADD COLUMN family_id INTEGER;
ALTER TABLE price_searches ADD COLUMN family_id INTEGER;

-- Discussion secrète entre ceux qui offrent, par cadeau et par famille (jamais vue par la personne gâtée).
CREATE TABLE IF NOT EXISTS wish_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wish_id    INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wish_messages ON wish_messages(wish_id, family_id, created_at);

-- Reçu : le cadeau quitte les listes et passe dans les archives.
ALTER TABLE wishes ADD COLUMN received_at TEXT;

-- Anniversaire (AAAA-MM-JJ, l'année ne sert pas) et rappels par email (1 = oui).
ALTER TABLE users ADD COLUMN birthday TEXT;
ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1;

-- Connexion par code envoyé par email (quand AUTH_MODE = "email").
CREATE TABLE IF NOT EXISTS login_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email, created_at);

-- Rappels déjà envoyés (pour ne jamais envoyer deux fois le même).
CREATE TABLE IF NOT EXISTS reminders_sent (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key)
);
