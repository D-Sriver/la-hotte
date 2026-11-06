-- À lancer une fois sur une base existante (npm run db:migrate:remote).
ALTER TABLE users ADD COLUMN joined INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN join_failures INTEGER NOT NULL DEFAULT 0;
-- Les personnes déjà inscrites étaient autorisées une par une dans Access : elles font partie de la famille.
UPDATE users SET joined = 1;
