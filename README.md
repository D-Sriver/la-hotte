# La Hotte

Listes de cadeaux pour la famille, avec des idées proposées par l’IA (Workers AI, gratuit).

- Chacun remplit son profil (ce qu'il aime, ce qu'il a déjà, à éviter, tailles, budget) et colle des liens.
- Pour un proche : on voit sa liste, on réserve en secret, on ajoute des idées secrètes.
- « Chercher des idées » : l’IA de Cloudflare (gpt-oss-120b) propose 5 cadeaux à partir du profil,
  de la liste d’envies et des cadeaux déjà reçus. Les idées s’affichent une à une, dès qu’elles arrivent.
  Elle ne navigue pas sur le web : chaque idée a un lien « Chercher en ligne » pour vérifier prix et stock.
- Les idées proposées sont gardées (« Idées déjà proposées »). 👍 / 👎 et « Je garde ! » servent à l’IA
  pour viser plus juste la fois suivante et ne pas se répéter.
- « Ce que j’offre » : le budget prévu, le total par personne et ce qui a déjà été offert dans l’année.
- Rappels avant Noël et les anniversaires (notifications sur le téléphone, ou email) : pour qui rien n’est prévu,
  les listes vides, les cagnottes pas bouclées.
- La personne concernée ne voit jamais les réservations, les idées ajoutées par les autres
  ni les idées de l’IA cherchées pour elle.

Stack : React (Vite) + Cloudflare Pages Functions + D1 + Workers AI.
Connexion par Cloudflare Access (par défaut) ou par code envoyé par email (`AUTH_MODE = "email"`).
On ne voit les autres qu’après avoir créé ou rejoint une famille (code ou lien d’invitation).

## Tester en local

```bash
npm install
npx wrangler login               # une seule fois : Workers AI tourne sur ton compte Cloudflare même en local
cp .dev.vars.example .dev.vars
npm run db:local                 # crée la base locale et applique les migrations
npm run preview                  # http://localhost:8788
npm test                         # tests (règles de secret, idées, budget, rappels), sans rien installer de plus
npm run lint                     # ESLint (erreurs réelles, règles des hooks React)
npm run format                   # Prettier (mise en forme du code)
```

Ajoute `?as=bjarni@test.fr` à l'URL pour jouer un autre membre (uniquement avec `DEV_MODE=1`).

## Mettre en ligne

1. `npx wrangler login`
2. `npx wrangler d1 create la-hotte` puis copie le `database_id` dans `wrangler.toml`.
3. `npm run db:remote` (crée les tables et applique les migrations).
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

Connexion par email au lieu d’Access : `AUTH_MODE = "email"`, plus les secrets `SESSION_SECRET`,
`RESEND_API_KEY` et la variable `EMAIL_FROM` (adresse vérifiée chez Resend).
Notifications : `npm run setup:push` (clés VAPID), puis `npm run deploy:reminders` pour le Worker des rappels.

## Faire évoluer la base

Chaque changement de la base est un fichier de `migrations/`. wrangler note ceux qui sont déjà passés
(table `d1_migrations`) et n’applique que les nouveaux, dans l’ordre :

```bash
npm run db:migrate:local         # en local
npm run db:migrate               # en ligne
```

Une base créée avant ce système (migrations 001 à 010 lancées à la main) doit d’abord être « adoptée », une seule fois :
`npx wrangler d1 execute la-hotte --remote --file=scripts/adopt-migrations.sql`, puis `npm run db:migrate`.

`npm run db:reset:lists` efface toutes les listes en ligne : ce n’est pas une migration, il ne se lance qu’à la main.

## Surveiller et sauvegarder

- **Erreurs** : `npm run errors` affiche les 30 dernières (navigateur et serveur). Avec le secret `ADMIN_EMAIL`
  sur le Worker des rappels (`npx wrangler secret put ADMIN_EMAIL --config reminders/wrangler.toml`),
  l'administrateur reçoit chaque matin une notification s'il y en a eu.
- **Sauvegardes** : chaque nuit dans KV, 30 jours. `npm run backup:list`, puis
  `npm run backup:restore -- AAAA-MM-JJ` écrit un fichier SQL à relire avant de l'exécuter (il remplace toute la base).
  Pour un retour en arrière récent, D1 a aussi son Time Travel : `npx wrangler d1 time-travel restore la-hotte --timestamp=…`.
- **Tests dans le navigateur** : `npm run test:e2e` (Playwright avec le Chrome installé, base locale neuve).

## Liste partagée hors de la famille

Chacun peut créer, dans « Ma liste », un lien en lecture seule (`/liste/<jeton>`) : ses envies, sans réservations ni
idées secrètes. Avec Cloudflare Access, ajoute une application « Bypass » pour le chemin `la-hotte.pages.dev/liste`
(Zero Trust → Access → Applications → Self-hosted, chemin `liste`, politique Action « Bypass », Include « Everyone »),
sinon les invités tombent sur l'écran de connexion.

## Coût

Tout est gratuit à cette échelle. Workers AI offre 10 000 « neurons » par jour sur le plan gratuit.
gpt-oss-120b compte le texte lu et écrit, réflexion comprise : une recherche d’idées coûte de l’ordre
de 100 à 300 neurons selon la longueur du profil et de la réflexion (estimation, à vérifier dans
le tableau de bord Cloudflare → Workers AI), soit quelques dizaines de recherches par jour pour tout le monde. Au-delà, les requêtes échouent jusqu’au lendemain
(sans facturation sur le plan gratuit). Limite par défaut : 10 recherches par personne et par jour
(`IDEAS_PER_DAY`). Pour des réponses plus rapides mais moins bonnes, essaie `@cf/meta/llama-3.3-70b-instruct-fp8-fast` dans `AI_MODEL`.
Kimi, GLM et DeepSeek demandent l’offre Workers payante ; Gemma 4 et Llama 4 Scout ne renvoyaient pas de résultat exploitable.

## Structure

```
schema.sql              tables D1 (état après la migration 010)
migrations/             changements de la base, appliqués par wrangler
server/                 code partagé côté serveur (connexion, règles de secret, Workers AI, idées, notifications)
functions/api/          routes : me, families, join, people, wishes, reservations, ideas, push, auth
reminders/              Worker des rappels, lancé chaque matin
scripts/                adoption des migrations, remise à zéro des listes, clés de notification
tests/                  tests (node --test, base SQLite en mémoire)
src/                    front React
```

## Pistes pour la suite

- Profils sans compte (enfants) gérés par un parent.
- Notification quand quelqu'un ajoute une envie.
- Plusieurs groupes (famille, amis) et Secret Santa.
