#!/bin/sh
# Repart d'une base locale neuve : efface .wrangler/state/v3/d1, recrée les tables et applique les migrations.
# À lancer quand le site local plante sur une colonne manquante (« no such column »), signe d'une base trop ancienne.
# Ne touche jamais à la base en ligne. Arrête d'abord le serveur local (npm run preview) s'il tourne.
set -e
if pgrep -f "wrangler pages dev" >/dev/null; then
  echo "Le serveur local tourne : arrête-le (Ctrl+C) avant de réinitialiser la base." >&2
  exit 1
fi
rm -rf .wrangler/state/v3/d1
npm run db:local
echo "Base locale recréée. Relance : npm run preview"
