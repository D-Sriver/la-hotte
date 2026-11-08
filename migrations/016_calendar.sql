-- Lien d'abonnement aux anniversaires de la famille (Google Agenda, Calendrier d'Apple). NULL : pas de lien.
ALTER TABLE users ADD COLUMN calendar_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_calendar_token ON users(calendar_token);
