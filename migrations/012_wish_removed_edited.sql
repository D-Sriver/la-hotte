-- Une envie déjà réservée que son propriétaire supprime ou modifie :
-- elle disparaît de SA liste, mais celui qui l'offre la garde, avec un avertissement.
ALTER TABLE wishes ADD COLUMN removed_at TEXT; -- retirée par son propriétaire (gardée pour qui l'a réservée)
ALTER TABLE wishes ADD COLUMN edited_at TEXT;  -- dernière modification par son propriétaire
