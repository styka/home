#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# e2e-web.sh — uruchamianie testów E2E (klikaczy) w środowisku Claude Code
# on the web (zdalny, efemeryczny kontener z restrykcyjną siecią).
#
# DLACZEGO ten skrypt istnieje:
#   `scripts/e2e.sh` (lokalny, dla człowieka) zakłada Docker + pobieranie
#   przeglądarek przez Playwright. W sandboxie web OBA są zablokowane przez
#   politykę sieciową:
#     • cdn.playwright.dev      → 403 host_not_allowed (brak pobrania Chromium)
#     • rejestr Docker (blob)   → 403 (brak obrazu postgres:16-alpine)
#   Ten skrypt omija oba problemy: używa PRE-zainstalowanego Chromium z
#   /opt/pw-browsers i LOKALNEGO Postgresa (binaria są w obrazie), bez Dockera.
#
#   Pełny opis: worldofmag/docs/e2e/uruchamianie-e2e-claude.md
#
# UŻYCIE:
#   bash scripts/e2e-web.sh                      # smoke, projekt desktop
#   bash scripts/e2e-web.sh e2e/specs/notes.spec.ts
#   bash scripts/e2e-web.sh --project=desktop e2e/specs/smoke.spec.ts
#   (wszystkie argumenty są przekazywane do `playwright test`)
#
#   Domyślnie odpala TYLKO projekt `desktop`. Projekt `mobile` (iPhone 13)
#   używa silnika WebKit, którego w sandboxie NIE MA i nie da się pobrać —
#   dlatego mobile jest pomijany. Wymuś inaczej podając własne --project=...
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

PW_DIR="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"

echo "▶ 1/5 Zależności npm…"
[ -d node_modules ] || npm install

echo "▶ 2/5 Mapowanie pre-zainstalowanej przeglądarki Chromium…"
# @playwright/test oczekuje konkretnej rewizji (np. 1223), a w obrazie jest
# starsza (np. 1194). Wersje są kompatybilne na potrzeby smoke — mapujemy
# symlinkami katalog oczekiwanej rewizji na tę faktycznie zainstalowaną.
BJSON="node_modules/playwright-core/browsers.json"
want_rev() { grep -A3 "\"name\": \"$1\"" "$BJSON" | grep -m1 '"revision"' | grep -oE '[0-9]+'; }
CHROME_WANT="$(want_rev chromium)"
HS_WANT="$(want_rev chromium-headless-shell)"

# Faktycznie zainstalowany pełny Chromium (realny katalog z chrome-linux/chrome).
CHROME_HAVE_DIR="$(find "$PW_DIR" -maxdepth 1 -type d -name 'chromium-*' \
  -exec test -f '{}/chrome-linux/chrome' \; -print | sort -V | tail -1 || true)"
HS_HAVE_DIR="$(find "$PW_DIR" -maxdepth 1 -type d -name 'chromium_headless_shell-*' \
  -exec test -f '{}/chrome-linux/headless_shell' \; -print | sort -V | tail -1 || true)"

if [ -z "$CHROME_HAVE_DIR" ] || [ -z "$HS_HAVE_DIR" ]; then
  echo "✘ Nie znalazłem pre-zainstalowanego Chromium w $PW_DIR." >&2
  echo "  Sprawdź 'ls $PW_DIR' — patrz docs/e2e/uruchamianie-e2e-claude.md." >&2
  exit 1
fi

# Pełny Chromium: katalog oczekiwanej rewizji → faktyczna rewizja.
ln -sfn "$CHROME_HAVE_DIR" "$PW_DIR/chromium-$CHROME_WANT"
# Headless shell: w starszym buildzie binarka nazywa się 'headless_shell'
# i leży w 'chrome-linux/', a Playwright szuka 'chrome-headless-shell' w
# 'chrome-headless-shell-linux64/'. Mapujemy nazwę i układ katalogów.
ln -sfn headless_shell "$HS_HAVE_DIR/chrome-linux/chrome-headless-shell"
rm -rf "$PW_DIR/chromium_headless_shell-$HS_WANT"
mkdir -p "$PW_DIR/chromium_headless_shell-$HS_WANT"
ln -sfn "$HS_HAVE_DIR/chrome-linux" \
  "$PW_DIR/chromium_headless_shell-$HS_WANT/chrome-headless-shell-linux64"
echo "  Chromium: $CHROME_HAVE_DIR → rev $CHROME_WANT (oczekiwana)"

echo "▶ 3/5 Lokalny Postgres (bez Dockera)…"
PG_VER="$(ls /usr/lib/postgresql 2>/dev/null | sort -V | tail -1)"
if [ -z "$PG_VER" ]; then
  echo "✘ Brak lokalnego Postgresa (/usr/lib/postgresql/*)." >&2; exit 1
fi
pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
# Idempotentne utworzenie roli + bazy testowej.
sudo -u postgres psql -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || true
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'e2e') THEN
    CREATE ROLE e2e LOGIN PASSWORD 'e2e';
  END IF;
END $$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='worldofmag_e2e'" 2>/dev/null \
  | grep -q 1 || sudo -u postgres createdb -O e2e worldofmag_e2e

export DATABASE_URL="postgresql://e2e:e2e@localhost:5432/worldofmag_e2e"
export DIRECT_URL="$DATABASE_URL"
export AUTH_SECRET="${AUTH_SECRET:-e2e-local-secret-not-for-prod}"
export E2E_TEST_MODE=1
export DEMO=0

echo "▶ 4/5 Migracje Prisma…"
npx prisma migrate deploy >/dev/null

echo "▶ 5/5 Testy E2E (headless Chromium)…"
ARGS=("$@")
# Bez jawnego --project ograniczamy się do desktop (mobile=WebKit niedostępny).
if ! printf '%s\n' "${ARGS[@]:-}" | grep -q -- '--project'; then
  ARGS=(--project=desktop "${ARGS[@]:-}")
fi
# Bez podanego pliku/sciezki domyslnie odpalamy smoke (szybkie, zielone).
# Pelny zestaw: `bash scripts/e2e-web.sh e2e/specs` (uwaga: ma znane porazki
# w specach funkcjonalnych — patrz docs/e2e/uruchamianie-e2e-claude.md).
if ! printf '%s\n' "${ARGS[@]:-}" | grep -q -- 'e2e/specs'; then
  ARGS+=("e2e/specs/smoke.spec.ts")
fi
# UWAGA: w sandboxie uruchamiaj ten skrypt w tle (nohup … &) i czytaj log —
# foreground bywa ubijany (exit 144) przy długim biegu przeglądarki.
npx playwright test "${ARGS[@]}"
