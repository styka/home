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

# Headless autodetect: na maszynie bez X-serwera (np. kontener CI / Claude on the web)
# nie wymuszamy --headed, bo Chromium nie ma do czego się podłączyć. Filtrujemy ten flag.
ARGS=("$@")
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  echo "ℹ Brak DISPLAY — tryb headless (usuwam --headed jeśli podano)."
  FILTERED=()
  for a in "${ARGS[@]}"; do [ "$a" = "--headed" ] || FILTERED+=("$a"); done
  ARGS=("${FILTERED[@]}")
  export DEMO=0
fi

echo "▶ Uruchamiam lokalną bazę Postgres (Docker)…"
$DC -f docker-compose.e2e.yml up -d --wait

echo "▶ Stosuję migracje…"
npx prisma migrate deploy

echo "▶ Testy E2E…"
# Sanity-check: czy Chromium w ogóle wystartuje w tym środowisku. W świeżym
# kontenerze (Claude on the web) często brakuje bibliotek systemowych przeglądarki,
# a 'apt' bywa zablokowany polityką sieci — wtedy klikanie trzeba puścić w obrazie
# Docker z preinstalowanymi zależnościami (patrz e2e/README.md / scripts/e2e-docker.sh).
if ! node -e "require('@playwright/test').chromium.launch().then(b=>b.close()).catch(()=>process.exit(7))" 2>/dev/null; then
  echo "✘ Chromium nie startuje — brak bibliotek systemowych przeglądarki." >&2
  echo "  Napraw: 'npx playwright install-deps chromium' (wymaga sudo/sieci)," >&2
  echo "  albo uruchom testy w obrazie Playwrighta: 'bash scripts/e2e-docker.sh'." >&2
  $DC -f docker-compose.e2e.yml down -v >/dev/null 2>&1 || true
  exit 7
fi
npx playwright test "${ARGS[@]}"
