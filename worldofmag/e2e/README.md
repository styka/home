# Testy E2E (Playwright)

Klikające testy end-to-end odtwarzające scenariusze QA z `/qa` w prawdziwej
przeglądarce — wersja **desktopowa** i **mobilna** (iPhone 13).

## Dlaczego Playwright?

Selenium i Protractor są przestarzałe (Protractor oficjalnie zarchiwizowany).
Playwright daje: jeden runner, tryb „demo" z podglądem klikania (`--headed`
+ `slowMo`), wbudowaną emulację urządzeń (iPhone), projekty desktop/mobile,
auto-waiting, trace/video, i działa natywnie na macOS.

## Wymagania (jednorazowo)

```bash
cd worldofmag
npm install                 # instaluje też @playwright/test
npm run test:e2e:install    # pobiera silnik Chromium (≈ przeglądarka)
```

Potrzebna działająca baza danych w `.env.local` (`DATABASE_URL`, `DIRECT_URL`)
oraz `AUTH_SECRET`. Schema jest PostgreSQL — wskaż lokalnego Postgresa lub
testową gałąź Neon i zastosuj migracje:

```bash
npm run db:migrate          # lub: npx prisma migrate deploy
```

## Uruchomienie (jedna komenda, demo)

```bash
npm run test:e2e            # headed, slowMo, desktop + mobile — widać każde kliknięcie
```

Playwright sam wystartuje serwer (`npm run dev` z `E2E_TEST_MODE=1`), zaloguje
użytkowników testowych i odpali całą serię. Inne tryby:

```bash
npm run test:e2e:desktop    # tylko desktop (headed)
npm run test:e2e:mobile     # tylko iPhone 13 (headed)
npm run test:e2e:ci         # headless, równolegle (CI)
npm run test:e2e:ui         # interaktywny UI mode
npm run test:e2e:report     # raport HTML z ostatniego biegu
```

## Logowanie w testach (bez Google)

Aplikacja loguje się wyłącznie przez Google OAuth, którego nie da się
skryptować. Dlatego `src/lib/auth.ts` zawiera **dodatkowy provider
`credentials` aktywny tylko gdy `E2E_TEST_MODE=1`** — w produkcji (Render)
ta zmienna nigdy nie jest ustawiona, więc provider jest nieaktywny.

Projekt `setup` przed testami:
1. `setup/seed.setup.ts` — zakłada użytkowników testowych i wszystkie
   uprawnienia w bazie (`e2e/fixtures/db.ts`).
2. `setup/auth.setup.ts` — loguje ich przez endpoint credentials i zapisuje
   stan sesji do `e2e/.auth/{admin,limited}.json` (reużywany przez testy).

- **admin** (`e2e-admin@worldofmag.test`) — ma wszystkie uprawnienia, używany
  do scenariuszy pozytywnych w każdym module.
- **limited** (`e2e-limited@worldofmag.test`) — tylko `module.home`, używany do
  scenariuszy gating/blokad (`specs/gating.spec.ts`).

## Struktura

```
e2e/
  setup/        seed + logowanie (storage state)
  fixtures/     test.ts (POM jako fixtures), db.ts, users.ts
  pages/        Page Object Model (AppShell, ShoppingPage, …)
  specs/        testy per moduł + coverage.spec.ts (traceability)
```

Wzorce: **Page Object Model** (klasy w `pages/`) + **fixtures** Playwrighta
(POM wstrzykiwane do testów) + **storage state** dla auth. Locatory są
user-facing (`getByRole`/`getByText`/`getByPlaceholder`) — w kodzie nie ma
`data-testid`, więc opieramy się na widocznych etykietach (PL).

## Mapowanie na scenariusze QA

Każdy zaimplementowany test ma w tytule slug scenariusza, np.
`[scenario-create-list-positive]`. Plik `specs/coverage.spec.ts` importuje
definicje scenariuszy z `prisma/seeds/qa-*.ts` i generuje wpis dla **każdego**
z 201 scenariuszy: zaimplementowane są oznaczone jako pokryte, pozostałe jako
`fixme` z udokumentowanymi krokami — dzięki temu raport pokazuje pełny backlog
do domknięcia.

## Rozszerzanie

Aby zautomatyzować kolejny scenariusz: dopisz test w odpowiednim
`specs/<module>.spec.ts` (użyj POM z `pages/`), nadaj tytuł
`[<slug>] …` i dodaj slug do zbioru `IMPLEMENTED` w `coverage.spec.ts`.
```
