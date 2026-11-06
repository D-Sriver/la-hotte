-- À lancer UNE SEULE FOIS sur la base en ligne, qui a reçu les migrations 001 à 010 à la main :
--   npx wrangler d1 execute la-hotte --remote --file=scripts/adopt-migrations.sql
-- Ensuite, `npm run db:migrate` n'applique que les migrations suivantes, chacune une seule fois.
CREATE TABLE IF NOT EXISTS d1_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('001_join_code.sql'), ('002_wish_photo.sql'), ('003_group_bought_favorite.sql'), ('004_price_searches.sql'),
  ('005_contribution_amount.sql'), ('006_families.sql'), ('008_more.sql'), ('009_push.sql'), ('010_photos.sql');
