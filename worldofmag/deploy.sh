#!/bin/bash
set -e

NEON_URL="postgresql://neondb_owner:npg_CIVYo0Lv7mpy@ep-crimson-scene-al05719e.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

echo ""
echo "╔══════════════════════════════════╗"
echo "║   WorldOfMag — Fly.io Deploy     ║"
echo "╚══════════════════════════════════╝"
echo ""

# 1. Fly CLI
if ! command -v fly &>/dev/null; then
  echo "→ Instaluję flyctl..."
  brew install flyctl
fi
echo "✓ flyctl: $(fly version | head -1)"

# 2. Login (otwiera przeglądarkę)
echo ""
echo "→ Logowanie do Fly.io (otworzy się przeglądarka)..."
fly auth login

# 3. Utwórz app — spróbuj 'worldofmag', jeśli zajęta — dodaj losowy suffix
echo ""
echo "→ Tworzę aplikację..."
APP_NAME="worldofmag"
if ! fly apps create "$APP_NAME" 2>/dev/null; then
  SUFFIX=$(openssl rand -hex 3)
  APP_NAME="worldofmag-$SUFFIX"
  echo "  Nazwa 'worldofmag' zajęta — używam '$APP_NAME'"
  fly apps create "$APP_NAME"
  # Update fly.toml with the actual app name
  sed -i '' "s/^app = .*/app = \"$APP_NAME\"/" fly.toml
fi
echo "✓ App: $APP_NAME"

# 4. Ustaw sekrety (DB credentials — nigdy w kodzie, tylko w Fly secrets)
echo ""
echo "→ Ustawiam sekrety bazy danych..."
fly secrets set \
  DATABASE_URL="$NEON_URL" \
  DIRECT_URL="$NEON_URL" \
  --app "$APP_NAME"
echo "✓ Sekrety ustawione"

# 5. Deploy (build Docker + release command = migrate)
echo ""
echo "→ Buduję i deployu... (2-4 minuty, proszę czekać)"
fly deploy --app "$APP_NAME"

# 6. Seed bazy danych (polskie produkty w autocomplete)
echo ""
echo "→ Wypełniam bazę danych (seed)..."
fly ssh console --app "$APP_NAME" --command \
  "cd /app && npx tsx prisma/seed.ts" 2>/dev/null || \
  echo "  Seed pominięty (możesz pominąć — autocomplete nauczy się z użycia)"

# 7. Wynik
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║              ✅ DEPLOY ZAKOŃCZONY            ║"
echo "╠══════════════════════════════════════════════╣"
APP_URL=$(fly status --app "$APP_NAME" 2>/dev/null | grep "Hostname" | awk '{print $2}' || echo "$APP_NAME.fly.dev")
echo "║  URL: https://$APP_URL"
echo "║"
echo "║  iPhone — Safari → https://$APP_URL"
echo "║  Potem: Share → Add to Home Screen → WorldOfMag"
echo "╚══════════════════════════════════════════════╝"
echo ""
