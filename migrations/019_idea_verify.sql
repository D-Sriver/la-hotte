-- Idées de l'IA : l'IA était-elle sûre du produit, et a-t-on retrouvé ce produit en boutique ?
ALTER TABLE ai_ideas ADD COLUMN certain INTEGER NOT NULL DEFAULT 0;   -- 1 : l'IA cite un produit précis dont elle est sûre
ALTER TABLE ai_ideas ADD COLUMN verified INTEGER;                      -- NULL : pas vérifiée, 1 : trouvée en boutique, 0 : introuvable
ALTER TABLE ai_ideas ADD COLUMN found_price TEXT;
ALTER TABLE ai_ideas ADD COLUMN found_shop TEXT;
ALTER TABLE ai_ideas ADD COLUMN found_url TEXT;
