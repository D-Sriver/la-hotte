-- Cadeaux reçus saisis à la main : de la part de qui (la date est received_at).
ALTER TABLE wishes ADD COLUMN received_from TEXT;
