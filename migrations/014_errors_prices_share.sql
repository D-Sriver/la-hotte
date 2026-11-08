-- Journal d'erreurs, suivi des prix des cadeaux réservés, lien de partage en lecture seule.

-- Erreurs vues par la famille (navigateur) ou par le serveur, pour les corriger sans attendre qu'on nous le dise.
CREATE TABLE IF NOT EXISTS error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,          -- 'client' ou 'server'
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '', -- pile d'appels, ou méthode et chemin de la requête
  page       TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at);

-- Prix relu chaque matin sur la page du produit, pour les cadeaux réservés pas encore achetés.
-- Gardé à part : le prix affiché dans la liste ne bouge pas, sinon la personne gâtée devinerait la réservation.
CREATE TABLE IF NOT EXISTS price_watch (
  wish_id     INTEGER PRIMARY KEY REFERENCES wishes(id) ON DELETE CASCADE,
  first_price REAL,                  -- premier prix relu
  last_price  REAL,                  -- dernier prix relu (NULL : page illisible, prix non suivi)
  alerted_at_price REAL,             -- plus bas prix déjà signalé (on ne prévient qu'une fois par baisse)
  checked_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE users ADD COLUMN notify_prices INTEGER NOT NULL DEFAULT 1; -- baisses de prix

-- Lien de partage de sa liste hors de la famille (lecture seule). NULL : pas de lien.
ALTER TABLE users ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token);
