-- Plusieurs photos par envie (carrousel), chacune avec son recadrage. À lancer une fois (npm run db:migrate:photos).
-- Chaque photo a son propre numéro : une photo remplacée a une nouvelle adresse, jamais d'ancienne image en cache.
CREATE TABLE IF NOT EXISTS wish_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wish_id    INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  photo      TEXT NOT NULL,         -- JPEG en data URL, réduite côté navigateur
  frame      TEXT,                  -- recadrage "x,y,zoom" (NULL = image entière)
  position   INTEGER NOT NULL DEFAULT 0, -- 0 = couverture
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wish_photos ON wish_photos(wish_id, position);

-- Les photos existantes deviennent la couverture de leur envie ; l'ancienne colonne est vidée.
INSERT INTO wish_photos (wish_id, photo, position) SELECT id, photo, 0 FROM wishes WHERE photo IS NOT NULL;
UPDATE wishes SET photo = NULL WHERE photo IS NOT NULL;
