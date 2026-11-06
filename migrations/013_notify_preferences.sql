-- Choisir ce qu'on reçoit en notification (notify_email reste « rappels du matin »).
ALTER TABLE users ADD COLUMN notify_messages INTEGER NOT NULL DEFAULT 1; -- discussions secrètes
ALTER TABLE users ADD COLUMN notify_groups   INTEGER NOT NULL DEFAULT 1; -- cagnottes lancées ou rejointes
