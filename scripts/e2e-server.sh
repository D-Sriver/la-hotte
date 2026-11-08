#!/bin/sh
# Serveur des tests de bout en bout : une base locale neuve à chaque lancement (dossier .wrangler/e2e),
# le site construit, et la connexion de dev (?as=email) activée. N'utilise ni la base de prod ni ta base locale.
set -e
rm -rf .wrangler/e2e
npx wrangler d1 execute la-hotte --local --persist-to .wrangler/e2e --file=schema.sql >/dev/null
npx wrangler d1 migrations apply la-hotte --local --persist-to .wrangler/e2e >/dev/null
npm run build >/dev/null
exec npx wrangler pages dev dist --port 8790 --persist-to .wrangler/e2e --binding DEV_MODE=1 --binding DEV_EMAIL=
