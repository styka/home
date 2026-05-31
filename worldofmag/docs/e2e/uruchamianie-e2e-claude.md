# Uruchamianie testów E2E (klikaczy) — runbook dla Claude Code on the web

> **Cel:** żeby przy poleceniu „puść testy e2e / klikacze" nie trzeba było
> znowu metodą prób i błędów odkrywać, jak obejść ograniczenia zdalnego
> sandboxa. Tu jest gotowa, sprawdzona ścieżka.

## TL;DR — jedna komenda

```bash
cd worldofmag
nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &   # uruchom w TLE
# poczekaj aż proces zniknie, potem:
tail -40 /tmp/e2e.log
```

`scripts/e2e-web.sh` robi wszystko: instaluje zależności, mapuje
pre-zainstalowaną przeglądarkę, podnosi lokalnego Postgresa, migruje bazę i
odpala projekt **desktop** (Chromium, headless). Oczekiwany wynik: **12 passed**
dla `e2e/specs/smoke.spec.ts`.

Domyślnie (bez argumentów) skrypt odpala **smoke** — szybkie i zielone.
Inne specy / cały zestaw:
```bash
nohup bash scripts/e2e-web.sh e2e/specs/notes.spec.ts > /tmp/e2e.log 2>&1 &  # jeden spec
nohup bash scripts/e2e-web.sh e2e/specs > /tmp/e2e.log 2>&1 &                 # CALY zestaw
```

> ⚠️ **Pełny zestaw ma znane porażki** w specach funkcjonalnych
> (`shopping`, `notes`, `qa`, `reports`, `settings`, `gating`) — to backlog
> scenariuszy do domknięcia, nie regresja smoke. Do szybkiej weryfikacji
> „czy żyje" używaj domyślnego smoke.

---

## Dlaczego nie działa „normalny" sposób (`npm run test:e2e:local`)

Lokalny przepływ zakłada **Docker** (baza) i **pobieranie przeglądarek**
przez Playwright. W sandboxie web polityka sieciowa blokuje OBA:

| Zasób | Efekt |
|-------|-------|
| `cdn.playwright.dev` | `403 host_not_allowed` → `npx playwright install` NIE pobierze Chromium |
| rejestr Docker (blob na CloudFront) | `403 Forbidden` → `docker pull postgres:16-alpine` NIE zadziała |
| npm registry | ✅ działa (`npm install` OK) |

Dlatego korzystamy z tego, co już jest w obrazie kontenera.

---

## Co JEST dostępne w obrazie (i jak to wykorzystać)

### 1. Pre-zainstalowana przeglądarka Playwright
- Katalog: `/opt/pw-browsers` (zmienna `PLAYWRIGHT_BROWSERS_PATH` już ustawiona).
- Zawiera **Chromium** + **chromium_headless_shell** + ffmpeg. **NIE ma WebKit
  ani Firefox.**
- **Problem wersji:** `@playwright/test` w repo (np. 1.60) oczekuje konkretnej
  rewizji buildu (np. `chromium-1223`), a w obrazie bywa starsza (np.
  `chromium-1194`, Chromium 141). Trzeba **zmapować symlinkami** katalog
  oczekiwanej rewizji na faktyczną:

  ```bash
  PW=/opt/pw-browsers
  # pełny chromium
  ln -sfn $PW/chromium-1194 $PW/chromium-1223
  # headless shell: stara nazwa 'headless_shell' w 'chrome-linux/',
  # nowy układ to 'chrome-headless-shell' w 'chrome-headless-shell-linux64/'
  ln -sfn headless_shell $PW/chromium_headless_shell-1194/chrome-linux/chrome-headless-shell
  mkdir -p $PW/chromium_headless_shell-1223
  ln -sfn ../chromium_headless_shell-1194/chrome-linux \
          $PW/chromium_headless_shell-1223/chrome-headless-shell-linux64
  ```

  Numery rewizji się zmieniają — odczytaj oczekiwaną z błędu
  (`Executable doesn't exist at .../chromium-XXXX/...`) albo z
  `node_modules/playwright-core/browsers.json`. Skrypt `e2e-web.sh` robi to
  automatycznie.

- **WebKit niedostępny** → projekt `mobile` (iPhone 13 = Safari/WebKit) **nie
  wystartuje**. Uruchamiamy tylko `--project=desktop`. To jedyny moduł
  pokrycia, którego w tym sandboxie nie da się odtworzyć.

### 2. Lokalny PostgreSQL (zamiast Dockera)
Binaria Postgresa są w obrazie (`/usr/lib/postgresql/<wersja>`), klaster `main`
jest tylko zatrzymany. Podnosimy go i tworzymy bazę testową:

```bash
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE e2e LOGIN PASSWORD 'e2e';"
sudo -u postgres createdb -O e2e worldofmag_e2e
export DATABASE_URL="postgresql://e2e:e2e@localhost:5432/worldofmag_e2e"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
```

> Uwaga: schemat Prisma ma `provider = "postgresql"`, więc **musi** to być
> Postgres (nie SQLite) — migracje są pisane pod Postgresa.

### 3. Logowanie w testach
Provider credentials w `src/lib/auth.ts` jest gated przez `E2E_TEST_MODE=1` i ma
`id: "e2e"`, więc callback to **`/api/auth/callback/e2e`** (nie `/credentials`).
To było źródłem buga naprawionego w `e2e/setup/auth.setup.ts` (patrz
`doświadczenia.md`, 2026-05-31).

---

## Pułapki wykonania

- **Foreground bywa ubijany** (`exit 144`) przy długim biegu przeglądarki w
  sandboxie. **Uruchamiaj w tle** (`nohup … &`), zapisuj do logu i czytaj log
  po zakończeniu. Sprawdzanie końca: `pgrep -f "playwright test"`.
- **Nie używaj `sleep` w foreground** do czekania — czekaj pętlą sprawdzającą
  `pgrep`.
- `webServer` w `playwright.config.ts` sam odpala `npm run dev` z
  `E2E_TEST_MODE=1` i dziedziczy `DATABASE_URL`/`AUTH_SECRET` z procesu —
  wystarczy wyeksportować je przed `playwright test`.
- Pierwszy bieg jest wolniejszy: Next dev kompiluje się na zimno.

---

## Zmienne środowiskowe (komplet)

```bash
export DATABASE_URL="postgresql://e2e:e2e@localhost:5432/worldofmag_e2e"
export DIRECT_URL="$DATABASE_URL"
export AUTH_SECRET="e2e-local-secret-not-for-prod"   # dowolny sekret wystarczy
export E2E_TEST_MODE=1                                # aktywuje provider 'e2e'
export DEMO=0                                         # bez slowMo (headless/CI)
```

## Weryfikacja działania

Powodzenie smoke = log kończy się:
```
  12 passed (XXs)
```
(seed bazy + 2× logowanie + 8 nawigacji modułów + konsola admina, projekt desktop).
