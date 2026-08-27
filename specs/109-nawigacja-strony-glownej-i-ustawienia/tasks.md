# Zadania: Nawigacja Strony głównej i podział widoku Ustawień

- **Plan:** ./plan.md (109-nawigacja-strony-glownej-i-ustawienia)
- **Status:** todo
- **Data:** 2026-08-27

> Kolejność: od najłatwiejszego do najtrudniejszego i zgodna z zależnościami. **Fazy 0 i 1 są
> niezależne od siebie** — pierwsza to panel boczny (mała, samodzielna zmiana), druga to podział
> Ustawień. Faza 0 idzie pierwsza, bo jest krótka i domyka jedno z dwóch zgłoszeń w całości.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych

**Brak.** Feature nie rusza schematu (plan §2): żadnej migracji, żadnej zmiany `schema.prisma`,
`npm run check:migrations` i `check:schema-drift` nie mają nowego materiału. Zapisane wprost, żeby
nie wyglądało na przeoczenie.

## Faza 1 — Panel boczny: jedno nazwane wejście na Stronę główną

- [x] **T-1** — `src/lib/modules.tsx`: dodaj `modulStronyGlownej(): ModuleDef | null` czytające wpis
      `home` z `MODULES`. Bez zmian w `resolveMenu` — Strona główna dalej **nie wraca** do listy
      menu, „Więcej…", ekranu zarządzania menu ani dolnego paska.
      *Gotowe, gdy:* funkcja zwraca deklarację (href `/`, `exact`, ikona, kolor, `permission`),
      `resolveMenu` zwraca to samo co przed zmianą (test jednostkowy albo `tsc` + odczyt kodu).

- [x] **T-2** — `ModuleSidebar`: `NavItem` dostaje `aria-current={isActive ? "page" : undefined}`.
      Zmiana w jednym miejscu, korzystają z niej wszystkie pozycje menu.
      *Gotowe, gdy:* na dowolnej trasie modułu aktywna pozycja ma `aria-current="page"`, nieaktywne
      nie mają atrybutu. (AC-3)

- [x] **T-3** — `ModuleSidebar`, trzy zmiany układu:
      1. nazwa aplikacji przestaje być `<Link>` → `<div>` z `BrandLogo` + `AppName`;
      2. **nowy wiersz „Strona główna"** (`NavItem` z danych `modulStronyGlownej()`), renderowany
         **między nazwą aplikacji a rzędem ikon konta**, z `locked={isPathLocked(userPermissions, "/")}`;
      3. ikona domu znika z rzędu ikon konta (zostają gwiazdka i ściągawka skrótów).
      Komentarz w kodzie ma powiedzieć wprost, że **109 odwraca decyzję z 087** i dlaczego wiersz
      stoi nad rzędem ikon, a nie w `<nav>`.
      *Gotowe, gdy:* w panelu widocznych jest dokładnie **jedno** wejście na `/`, opisane słowami,
      stojące nad gwiazdką i nad pierwszą pozycją `<nav>`. (AC-1, AC-2, AC-4, AC-6)

- [x] **T-4** `[P]` — `e2e/specs/rama-i-chrom.spec.ts`: aktualizacja dwóch testów kodujących
      decyzję z 087 — `[087-AC17]` (asercja o Stronie głównej odwrócona; asercja o Ulubionych
      **zostaje**) i `[087-AC19+AC20]` (`dom` nie jest już w rzędzie ikon, tylko we własnym wierszu
      nad nim). W komentarzu zapisz, że zmienia to 109, żeby następna osoba tego nie „naprawiła".
      *Gotowe, gdy:* oba testy opisują stan docelowy i przechodzą.

## Faza 2 — Ustawienia: rejestr sekcji i szkielet widoku

- [x] **T-5** — `src/lib/ustawienia/sekcje.tsx`: rejestr `SEKCJE_USTAWIEN` (10 pozycji wg tabeli
      z planu §5.2) + `znajdzSekcje(id)`. Każda pozycja: `id`, `Ikona`, `kluczNazwy`, `kluczOpisu`,
      `kluczHasel`. **Żadnych literałów tekstowych** — same klucze (C-32).
      *Gotowe, gdy:* rejestr ma 10 pozycji o unikalnych, ASCII-owych `id` w kolejności
      `konto, wyglad, nawigacja, jezyk, polaczenia, asystent, zespoly, pomoc, prywatnosc, aktywnosc`.

- [x] **T-6** — `messages/pl.json`: nazwy, opisy i hasła wyszukiwarki dla 10 sekcji + teksty
      wyszukiwarki (etykieta pola, `placeholder`, stan pusty) i okruszka.
      *Gotowe, gdy:* każdy klucz z T-5 ma wartość; `npm run check:i18n` przechodzi.

- [x] **T-7** — `src/lib/ustawienia/__tests__/sekcje.test.ts`: dla każdej pozycji rejestru
      sprawdź obecność wszystkich trzech kluczy w `messages/pl.json`, oraz unikalność `id`.
      To **zastępstwo za bramkę i18n**, która nie widzi kluczy dynamicznych (plan §5.2).
      *Gotowe, gdy:* `npm run test:unit` zielony i test faktycznie czerwienieje po usunięciu klucza
      (sprawdź próbą mutacyjną). (AC-19)

- [x] **T-8** — `src/components/settings/SpisUstawien.tsx` (klient): pole szukania + lista;
      prop `wariant: "kafelki" | "lista"`, prop `aktywna?`. Filtrowanie po nazwie, opisie i haśle,
      **po normalizacji diakrytyków** (`String.normalize("NFD")`, bez nowej zależności). Brak
      trafień → stan pusty z wyjaśnieniem. Cele dotyku ≥ 44 px, kolory wyłącznie ze zmiennych CSS.
      *Gotowe, gdy:* „skorka" znajduje „Wygląd", „qqq" pokazuje stan pusty. (AC-13, AC-14, AC-15)

- [x] **T-9** `[P]` — test jednostkowy funkcji filtrującej ze spisu (bez diakrytyków, wielkość
      liter, dopasowanie po haśle). *Gotowe, gdy:* `test:unit` zielony. (AC-15)

- [x] **T-10** — `src/components/settings/RamaSekcji.tsx` (klient): `ModuleView` z `layout="fill"`,
      `state="ready"`, `breadcrumb` → `/settings`, tytuł i ikona sekcji; w środku lista boczna
      (`hidden md:flex`, `SpisUstawien` wariant `lista`) + treść z własnym przewijaniem i dolnym
      wypełnieniem `calc(16px + env(safe-area-inset-bottom))`.
      *Gotowe, gdy:* na 1280 px lista i treść przewijają się osobno, na 390 px listy bocznej nie ma.
      (AC-7, AC-8, AC-16, AC-18)

## Faza 3 — Ustawienia: przeniesienie treści i trasy

> Sekcje przenosimy **1:1**, bez przeprojektowywania zawartości (C-53). Każda jest osobnym
> **serwerowym** komponentem i awaituje wyłącznie swoje dane — to jest właściwy cel podziału.

- [ ] **T-11** — `src/components/settings/sekcje/Konto.tsx` — profil (awatar, nazwa, e-mail) +
      formularz `signOut`. *Gotowe, gdy:* wylogowanie działa jak przed zmianą.
- [ ] **T-12** `[P]` — `Wyglad.tsx` — `SkinPicker` (`listAvailableSkins`, `getActiveSkinId`,
      `getMyTeams` → `teamOpts`).
- [ ] **T-13** `[P]` — `Nawigacja.tsx` — `MenuPrefsEditor` + `FavoriteViewsEditor`; **zachowaj
      kotwicę `id="ulubione"`** na bloku ulubionych. (AC-11)
- [ ] **T-14** `[P]` — `Jezyk.tsx` — `WorkspaceLocaleSection`; przy braku danych **stan pusty
      z wyjaśnieniem**, nigdy pusty ekran.
- [ ] **T-15** `[P]` — `Polaczenia.tsx` — `DriveSettings` (z `notice` z `searchParams.drive`) +
      `IcalFeedCard`.
- [ ] **T-16** `[P]` — `Asystent.tsx` — plan (`getActivePlan`) + `AiUsageMeters` (`getMyAiUsage`) +
      `UserFactsSection`; sekcje warunkowe ze stanem pustym.
- [ ] **T-17** `[P]` — `Zespoly.tsx` — lista zespołów (`getMyTeams`) + odnośnik „Nowy zespół".
- [ ] **T-18** `[P]` — `Pomoc.tsx` — opis + odnośnik do `/guide`.
- [ ] **T-19** `[P]` — `Prywatnosc.tsx` — `PrivacySettings` + odnośnik do `/legal`.
- [ ] **T-20** `[P]` — `Aktywnosc.tsx` — `ActivityFeed` (`getRecentActivity(30)`, uprawnienia).

- [ ] **T-21** — `src/app/settings/[sekcja]/page.tsx` (server): `auth()` + przekierowanie przy
      braku sesji, walidacja segmentu przez `znajdzSekcje` → `notFound()`, dobór komponentu sekcji,
      przekazanie `searchParams` tam, gdzie sekcja go potrzebuje (`polaczenia`).
      *Gotowe, gdy:* każdy z 10 adresów renderuje swoją sekcję, `/settings/nieistniejaca` daje 404,
      `/settings/team/new` działa jak dotąd. (AC-9, AC-12)

- [ ] **T-22** — `src/app/settings/page.tsx`: przepisanie na **spis** — `ModuleView` (tytuł
      „Ustawienia", `state="ready"`) + `SpisUstawien` wariant `kafelki`. Ręcznie rysowany `<h1>`
      i cała jednokolumnowa treść znikają.
      *Gotowe, gdy:* `/settings` pokazuje 10 kafelków mieszczących się bez przewijania na 1280 px
      i całą szerokość listy na 390 px. (AC-7, AC-8, AC-16)

- [ ] **T-23** — `src/lib/ui/view-contract.json`: wpis `settings` z `exempt` na `done` + wpisy
      wskazujące `SpisUstawien` i `RamaSekcji`.
      *Gotowe, gdy:* `npm run check:ui-contract` przechodzi. (AC-16, AC-17)

- [ ] **T-24** — Sprawdź, że `permissionForPath("/settings/<sekcja>")` zwraca to samo co
      `permissionForPath("/settings")` (`legacyPermissionForPath` w `platform/auth/permissions.ts`);
      jeśli nie — dopasuj dopasowanie po prefiksie.
      *Gotowe, gdy:* test jednostkowy dla `/settings`, `/settings/wyglad`, `/settings/team/new`
      zwraca `module.settings`. (C-22)

- [ ] **T-25** — Odnośniki w głąb ustawień (tabela z planu §5.4): `api/drive/callback/route.ts`,
      `ImageUrlInput.tsx`, `admin/reports/new/page.tsx` → `/settings/polaczenia`;
      `legal/page.tsx` → `/settings/prywatnosc`; `PasekKciukaPolaczony.tsx` (`/settings#menu`)
      i `FavoritesSwitcher.tsx` → `/settings/nawigacja`.
      *Gotowe, gdy:* `grep -rn "/settings#" src` nie zwraca nic, a każdy zmieniony odnośnik prowadzi
      do sekcji, która faktycznie zawiera opisaną rzecz. (AC-11)

## Faza 4 — AI / integracje

**Nie dotyczy** (plan §6): zero nowych `AIAction`, read-toolów, wpięć w kalendarz, powiadomienia
i kosz. `npm run check:actions`, `check:ai-coverage` i `check:cost-badge` przechodzą bez nowego
materiału — sprawdzane w T-27 razem z resztą buildu.

## Faza 5 — Klikacz, bramki i domknięcie

- [ ] **T-26** — `e2e/specs/109-nawigacja-i-ustawienia.spec.ts`: testy dla AC-1…AC-19 wg mapowania
      z planu §8. Aktualizacja istniejących specek, które wchodzą w ustawienia:
      `favorites.spec.ts` (ulubione → `/settings/nawigacja`), `teams.spec.ts` (zespoły →
      `/settings/zespoly`). **Bez `networkidle`** (`check:e2e-waits`).
      *Gotowe, gdy:* nowy spec przechodzi i żaden istniejący nie czerwienieje z powodu zmiany tras.

- [ ] **T-27** — Bramki lokalnie na lokalnym Postgresie (C-13, **nigdy prod `DATABASE_URL`**):
      `check:i18n` → `check:ui-contract` → `check:test-types` → `test:unit` → `next lint --dir src`
      → `npm run build` **do kroku `next build`** (bez `scripts/migrate.js`).
      *Gotowe, gdy:* wszystko zielone. Jeśli `check:perf` zaprotestuje — podnieś próg
      w `src/lib/ui/perf-baseline.json` **z powodem w polu opisowym**, nigdy po cichu.

- [ ] **T-28** — Uruchomienie klikacza: `nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`,
      potem `tail -40 /tmp/e2e.log`. *Gotowe, gdy:* nowy spec zielony, a liczba czerwonych
      w pozostałych nie rośnie względem stanu sprzed zmiany.

- [ ] **T-29** — Mapowanie każdego AC ze speca na wynik (wejście dla `/verify`).

- [ ] **T-30** — Wpis do `doświadczenia.md` (C-51): odwrócenie decyzji z 087 i lekcja o czytaniu
      zgłoszenia opisującego stan sprzed kilku przebiegów (zgłoszenie nazywa OBJAW z chwili, gdy
      je pisano — przed zmianą sprawdź, co kod robi DZIŚ).

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1 pozycja „Strona główna" pierwsza i nazwana | T-1, T-3, T-26 |
| AC-2 dokładnie jedno wejście na `/` | T-3, T-4, T-26 |
| AC-3 stan aktywny czytelny dla czytnika | T-2, T-26 |
| AC-4 jedno kliknięcie z dowolnego modułu | T-3, T-26 |
| AC-5 telefon bez zmian | T-1 (brak zmian w `resolveMenu`), T-26 |
| AC-6 brak uprawnienia → pozycja zablokowana | T-3, T-26 |
| AC-7 spis bez przewijania / lista obok treści | T-8, T-10, T-22, T-26 |
| AC-8 telefon: spis → sekcja z powrotem | T-10, T-22, T-26 |
| AC-9 własny adres każdej sekcji | T-21, T-26 |
| AC-10 wszystkie 13 sekcji przeniesione | T-11…T-20, T-29 |
| AC-11 stare odnośniki w głąb działają | T-13 (kotwica), T-25, T-26 |
| AC-12 sekcja pobiera tylko swoje dane | T-11…T-21, T-29 |
| AC-13 wyszukiwarka prowadzi do sekcji | T-8, T-26 |
| AC-14 brak trafień → stan pusty | T-8, T-26 |
| AC-15 szukanie bez diakrytyków | T-8, T-9 |
| AC-16 standardowa rama widoku | T-10, T-22, T-23 |
| AC-17 kolory ze zmiennych motywu | T-8, T-10, T-23 |
| AC-18 obszar gestów na telefonie | T-10, T-26 |
| AC-19 teksty przez słownik | T-6, T-7, T-27 |

## Ścieżka krytyczna

`T-1 → T-3` (panel) · `T-5 → T-6 → T-8 → T-10 → T-21 → T-22 → T-23` (ustawienia) ·
wszystko → `T-26 → T-27 → T-28 → T-29`.
T-11…T-20 zależą wyłącznie od T-10 i między sobą są równoległe.

## Notatki / blokady
- Brak.
