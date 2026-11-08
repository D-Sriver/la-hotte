-- Budget par personne (privé : seul celui qui offre le voit), administrateur, dernière visite.

CREATE TABLE IF NOT EXISTS gift_budgets (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- celui qui offre
  person_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- pour qui
  amount    REAL NOT NULL,
  PRIMARY KEY (user_id, person_id)
);

-- L'administrateur voit le tableau de bord (chiffres globaux, jamais qui offre quoi).
-- Par défaut, le premier compte créé.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users);

-- Dernière visite (à l'heure près), pour compter les membres actifs.
ALTER TABLE users ADD COLUMN last_seen_at TEXT;
