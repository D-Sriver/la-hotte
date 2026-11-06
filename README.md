# La Hotte

Listes de cadeaux pour la famille, avec des idées proposées par l’IA (Workers AI, gratuit).

- Chacun remplit son profil (ce qu'il aime, ce qu'il a déjà, à éviter, tailles, budget) et colle des liens.
- Pour un proche : on voit sa liste, on réserve en secret, on ajoute des idées secrètes.
- « Chercher des idées » : l’IA de Cloudflare (gpt-oss-120b) propose 5 cadeaux à partir du profil.
  Elle ne navigue pas sur le web : chaque idée a un lien « Chercher en ligne » pour vérifier prix et stock.
- La personne concernée ne voit jamais les réservations ni les idées ajoutées par les autres.

Stack : React (Vite) + Cloudflare Pages Functions + D1 + Workers AI + Cloudflare Access (connexion par code email).
Toute personne autorisée dans Access fait partie de la famille.

## Tester en local

```bash
npm install
npx wrangler login               # une seule fois : Workers AI tourne sur ton compte Cloudflare même en local
cp .dev.vars.example .dev.vars
npm run db:local
npm run preview                  # http://localhost:8788
```

Ajoute `?as=bjarni@test.fr` à l'URL pour jouer un autre membre (uniquement avec `DEV_MODE=1`).

## Mettre en ligne

1. `npx wrangler login`
2. `npx wrangler d1 create la-hotte` puis copie le `database_id` dans `wrangler.toml`.
3. `npm run db:remote` (crée les tables).
4. `npx wrangler pages project create la-hotte --production-branch main`
5. `npm run deploy`
6. Cloudflare Access (Zero Trust → Access → Applications → Add → Self-hosted) :
   - domaines : `la-hotte.pages.dev` et `*.la-hotte.pages.dev`
   - politique : Allow, Emails = les adresses de la famille
   - méthode de connexion : One-time PIN
7. Dans Pages → Settings → Variables, ajoute :
   - `ACCESS_TEAM_DOMAIN` = `tonequipe.cloudflareaccess.com`
   - `ACCESS_AUD` = l'« Application Audience (AUD) tag » de l'application Access
8. Redéploie (`npm run deploy`).

Ne mets jamais `DEV_MODE` en production : il désactive la vérification de connexion.

## Coût

Tout est gratuit à cette échelle. Workers AI offre 10 000 « neurons » par jour sur le plan gratuit ;
une recherche d’idées avec gpt-oss-120b en consomme environ 200 (estimation), soit une cinquantaine
de recherches par jour pour toute la famille. Au-delà, les requêtes échouent jusqu’au lendemain
(sans facturation sur le plan gratuit). Limite par défaut : 10 recherches par personne et par jour
(`IDEAS_PER_DAY`). Pour des réponses plus rapides mais moins bonnes, essaie `@cf/meta/llama-3.3-70b-instruct-fp8-fast` dans `AI_MODEL`.
Kimi, GLM et DeepSeek demandent l’offre Workers payante ; Gemma 4 et Llama 4 Scout ne renvoyaient pas de résultat exploitable.

## Structure

```
schema.sql              tables D1
server/                 code partagé côté serveur (auth Access, règles de secret, Workers AI)
functions/api/          routes : me, people, wishes, reserve, ideas
src/                    front React
```

## Pistes pour la suite

- Profils sans compte (enfants) gérés par un parent.
- Notification quand quelqu'un ajoute une envie.
- Plusieurs groupes (famille, amis) et Secret Santa.
