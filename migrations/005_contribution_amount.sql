-- À lancer une fois sur une base existante (npm run db:migrate:amounts).
ALTER TABLE contributions ADD COLUMN amount REAL; -- en euros, NULL = pas encore précisé
