-- À lancer une fois sur une base existante (npm run db:migrate:prices).
CREATE TABLE IF NOT EXISTS price_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
