-- Repartir de zéro (npm run db:reset:lists) : efface envies, idées secrètes, réservations et participations.
-- Ce n'est pas une migration : à ne lancer que volontairement.
-- Les comptes et profils (prénom, goûts, tailles) sont gardés ; chacun crée ou rejoint sa famille.
DELETE FROM contributions;
DELETE FROM wishes;
UPDATE users SET joined = 0, join_failures = 0;
