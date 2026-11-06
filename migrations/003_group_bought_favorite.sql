-- À lancer une fois sur une base existante (npm run db:migrate:gifts).
ALTER TABLE wishes ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wishes ADD COLUMN group_gift INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wishes ADD COLUMN bought INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS contributions (
  wish_id    INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (wish_id, user_id)
);
