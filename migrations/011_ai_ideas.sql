-- Les idées proposées par l'IA sont gardées : on les retrouve, on dit si elles tombent juste,
-- et l'IA s'en sert pour ne pas se répéter.
CREATE TABLE IF NOT EXISTS ai_ideas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- pour qui
  asked_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- qui a lancé la recherche
  family_id  INTEGER REFERENCES families(id) ON DELETE CASCADE,        -- NULL quand on cherche pour soi
  title      TEXT NOT NULL,
  why        TEXT NOT NULL DEFAULT '',
  price      TEXT NOT NULL DEFAULT '',
  shop       TEXT NOT NULL DEFAULT '',
  search_url TEXT,
  rating     INTEGER,               -- 1 : bien vu, -1 : à côté, NULL : pas d'avis
  kept       INTEGER NOT NULL DEFAULT 0, -- ajoutée à la liste
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_ideas_person ON ai_ideas(person_id, created_at);
