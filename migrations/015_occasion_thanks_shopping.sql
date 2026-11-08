-- L'occasion d'une réservation, le merci après Noël, et le suivi des prix par Google Shopping.

-- Pour quelle occasion on offre ce cadeau : 'christmas', 'birthday' ou 'other' (jamais montré à la personne gâtée).
ALTER TABLE wishes ADD COLUMN occasion TEXT;
-- La personne gâtée a dit merci (depuis son récap de Noël) : ceux qui ont offert le voient.
ALTER TABLE wishes ADD COLUMN thanked_at TEXT;

-- D'où vient le prix suivi : 'page' (la fiche produit) ou 'shopping' (Google Shopping, quand la boutique bloque).
-- Si la source change, on repart de zéro pour ne pas comparer deux prix qui ne se valent pas.
ALTER TABLE price_watch ADD COLUMN source TEXT;
ALTER TABLE price_watch ADD COLUMN shopping_checked_at TEXT; -- dernière recherche Google Shopping (une par semaine au plus)
