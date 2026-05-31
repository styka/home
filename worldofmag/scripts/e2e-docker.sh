#!/usr/bin/env bash
# Klikające testy E2E w środowisku BEZ bibliotek przeglądarki na hoście
# (np. świeży kontener Claude on the web, gdzie 'apt' jest zablokowany).
# Uruchamia Playwright w oficjalnym obrazie Microsoftu (ma wszystkie zależności),
# na sieci hosta, względem efemerycznej bazy z docker-compose.e2e.yml.
#
# Wymaga jedynie działającego Dockera. Argumenty przekazywane do playwright test:
#   bash scripts/e2e-docker.sh --project=desktop
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL="postgresql://e2e:e2e@localhost:5433/worldofmag_e2e"
export DIRECT_URL="$DATABASE_URL"
export AUTH_SECRET="${AUTH_SECRET:-e2e-local-secret-not-for-prod}"

DC="docker compose"
docker compose version >/dev/null 2>&1 || DC="docker-compose"

# Wersja Playwrighta z package.json → dobieramy zgodny tag obrazu.
PW_VERSION="$(node -p "require('@playwright/test/package.json').version" 2>/dev/null || echo "1.60.0")"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-jammy"

echo "▶ Baza Postgres (Docker)…"
$DC -f docker-compose.e2e.yml up -d --wait

echo "▶ Migracje…"
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" npx prisma migrate deploy

echo "▶ Playwright w obrazie ${IMAGE} (sieć hosta)…"
docker run --rm --network host -v "$PWD":/work -w /work \
  -e DATABASE_URL -e DIRECT_URL -e AUTH_SECRET \
  -e E2E_TEST_MODE=1 -e NODE_ENV=development -e CI=1 \
  "$IMAGE" npx playwright test "$@"
