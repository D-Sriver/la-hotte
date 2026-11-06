# La Hotte

Listes de cadeaux pour la famille, avec des idées trouvées sur le web par Claude.

- Chacun remplit son profil (ce qu'il aime, ce qu'il a déjà, à éviter, tailles, budget) et colle des liens.
- Pour un proche : on voit sa liste, on réserve en secret, on ajoute des idées secrètes.
- « Chercher des idées » : Claude fouille le web à partir du profil et propose 5 cadeaux.
  Seuls les liens vus pendant la recherche sont gardés ; sinon un lien « Chercher en ligne » est proposé.
- La personne concernée ne voit jamais les réservations ni les idées ajoutées par les autres.

Stack : React (Vite) + Cloudflare Pages Functions + D1 + Cloudflare Access (connexion par code email).
Toute personne autorisée dans Access fait partie de la famille.

## Tester en local

```bash
npm install
cp .dev.vars.example .dev.vars   # mets ta clé API Claude dedans pour tester la recherche
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
6. Clé API : `npx wrangler pages secret put ANTHROPIC_API_KEY`
7. Cloudflare Access (Zero Trust → Access → Applications → Add → Self-hosted) :
   - domaines : `la-hotte.pages.dev` et `*.la-hotte.pages.dev`
   - politique : Allow, Emails = les adresses de la famille
   - méthode de connexion : One-time PIN
8. Dans Pages → Settings → Variables, ajoute :
   - `ACCESS_TEAM_DOMAIN` = `tonequipe.cloudflareaccess.com`
   - `ACCESS_AUD` = l'« Application Audience (AUD) tag » de l'application Access
9. Redéploie (`npm run deploy`).

Ne mets jamais `DEV_MODE` en production : il désactive la vérification de connexion.

## Coût

Pages, Functions, D1 et Access sont gratuits à cette échelle. Chaque recherche d'idées appelle
l'API Claude avec la recherche web (estimation : quelques centimes). Limite par défaut :
20 recherches par personne et par jour (`IDEAS_PER_DAY` dans `wrangler.toml`).

## Structure

```
schema.sql              tables D1
server/                 code partagé côté serveur (auth Access, règles de secret, appel Claude)
functions/api/          routes : me, people, wishes, reserve, ideas
src/                    front React
```

## Pistes pour la suite

- Profils sans compte (enfants) gérés par un parent.
- Notification quand quelqu'un ajoute une envie.
- Plusieurs groupes (famille, amis) et Secret Santa.
