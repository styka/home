#!/usr/bin/env bash
# Jedna komenda: stawia lokalną bazę (Docker), migruje, odpala testy E2E (demo).
# Wszelkie argumenty są przekazywane do `playwright test`, np.:
#   npm run test:e2e:local -- --project=desktop
set -euo pipefail
cd "$(dirname "$0")/.."

# Połączenie do efemerycznej bazy z docker-compose.e2e.yml.
export DATABASE_URL="postgresql://e2e:e2e@localhost:5433/worldofmag_e2e"
export DIRECT_URL="$DATABASE_URL"
# Dowolny sekret wystarczy do logowania w trybie E2E (provider credentials).
export AUTH_SECRET="${AUTH_SECRET:-e2e-local-secret-not-for-prod}"
export E2E_TEST_MODE=1
export DEMO="${DEMO:-1}"

DC=""
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "✘ Brak Dockera. Zainstaluj Docker Desktop (lub Colima) — patrz e2e/README.md." >&2
  echo "  Alternatywnie: ustaw DATABASE_URL na własnego Postgresa i użyj 'npm run test:e2e'." >&2
  exit 1
fi

echo "▶ Uruchamiam lokalną bazę Postgres (Docker)…"
$DC -f docker-compose.e2e.yml up -d --wait

echo "▶ Stosuję migracje…"
npx prisma migrate deploy

echo "▶ Testy E2E (tryb demo — widać klikanie)…"
npx playwright test "$@"
