# Zadania: Panel administratora jako pogrupowana wyrzutnia

- **Plan:** ./plan.md (110-panel-admina-wyrzutnia)
- **Status:** todo
- **Data:** 2026-08-27

> Kolejność: od najłatwiejszego do najtrudniejszego i zgodna z zależnościami. Rejestr powstaje jako
> pierwszy, bo karmi wszystko pozostałe: spis, wyszukiwarkę, bramkę i testy.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych

**Brak.** Feature nie rusza schematu (plan §2): żadnej migracji, żadnej zmiany `schema.prisma`.
`check:migrations` i `check:schema-drift` nie mają nowego materiału. Zapisane wprost, żeby nie
wyglądało na przeoczenie.

## Faza 1 — Warstwa serwera

**Brak nowych Server Actions i mutacji** (plan §3). Jedenaście zapytań zliczających zmienia miejsce
wywołania (`/admin` → `/admin/przeglad`), nie treść — to część zadania T-12, nie osobna warstwa.

## Faza 2 — Rejestr, wyszukiwanie i bramka

- [x] **T-1** — `src/lib/ui/szukanie.ts`: przenieś `bezOgonkow` i `pasujeDoFrazy` z
      `src/lib/ustawienia/sekcje.ts` (czyste funkcje, nic nie wiedzą o ustawieniach — plan §5.1).
      `sekcje.ts` importuje je stamtąd; **żadnej kopii**.
      *Korekta z implementacji (C-54):* w repozytorium była już **druga kopia tej samej funkcji**,
      pod tą samą nazwą — `bezOgonkow` w `src/lib/nawigacja/szukajCelow.ts` (identyczne ciało,
      różnica tylko `toLowerCase()` vs `toLocaleLowerCase("pl-PL")`, dla polskiego bez znaczenia).
      Panel byłby trzecią, więc konsolidujemy obie. Kryterium „jedno trafienie `normalize(\"NFD\")`
      w `src/`" było błędne — dziewięć innych plików normalizuje NFD w zupełnie innych celach
      (slugi, klucze tekstu, wyszukiwarka przewodników).
      *Gotowe, gdy:* istnieje **jedna** definicja `bezOgonkow`/`pasujeDoFrazy` w `src/`, a testy
      rejestru ustawień (7) i wyszukiwarki celów nawigacji (8) przechodzą bez zmian w asercjach.

- [x] **T-2** — `src/lib/admin/narzedzia.ts`: typy `NarzedzieAdmina` / `GrupaNarzedzi`, stała
      `GRUPY_NARZEDZI` (7 grup, 24 pozycje + 1 akcja wg tabeli z planu §5.2) i `wszystkieNarzedzia()`.
      **Same klucze tekstów, zero literałów** (C-32). `id` = ostatni segment trasy pod `/admin`
      (klucz dla bramki); `/services/moderation` wchodzi jako `href` bez `id` spod `/admin`.
      *Gotowe, gdy:* rejestr zawiera `llm` i `qa` (dziś bez odnośnika) oraz `przeglad`, a `id` są
      unikalne i ASCII.

- [x] **T-3** — `messages/pl.json`: nazwy 7 grup, nazwy/opisy/hasła 25 pozycji, teksty wyszukiwarki
      (etykieta, `placeholder`, stan pusty, wyczyść), tytuł panelu i przeglądu, etykieta powrotu.
      *Gotowe, gdy:* każdy klucz z T-2 ma wartość; `npm run check:i18n` przechodzi.

- [x] **T-4** — `src/lib/admin/__tests__/narzedzia.test.ts`: dla każdej pozycji sprawdź obecność
      trzech kluczy w `messages/pl.json` oraz nazwy grupy; unikalność `id`; każdy wpis ma `href`.
      To **zastępstwo za bramkę i18n**, która nie widzi kluczy podawanych zmienną (plan §5.2).
      *Gotowe, gdy:* `test:unit` zielony **i** próba mutacyjna (usunięcie jednego klucza) czerwieni
      test z nazwą brakującego klucza. (AC-16)

- [x] **T-5** — `scripts/check-admin-links.js` + `src/lib/admin/linki-wyjatki.json` (pusty) +
      `package.json` (`check:admin-links`, wpięcie w `build`). Bramka w **obie strony**: katalog
      pierwszego poziomu w `src/app/admin/` z `page.tsx` bez wpisu = błąd; wpis na `/admin/<id>` bez
      katalogu = błąd; martwy wyjątek = błąd. **Wywala się przy zerze tras albo zerze wpisów**
      i wypisuje policzone liczby (plan §9).
      *Gotowe, gdy:* bramka przechodzi na komplecie **i** czerwienieje w dwóch próbach mutacyjnych —
      po usunięciu wpisu `llm` z rejestru oraz po dodaniu wpisu na nieistniejącą trasę. (AC-3)

## Faza 3 — Widoki panelu

- [x] **T-6** — `src/components/admin/SpisNarzedziAdmina.tsx` (klient): pole szukania + grupy
      z nagłówkami; filtr **chowa grupę, z której nic nie zostało**; brak trafień → stan pusty
      z wyjaśnieniem; pozycja z `akcja` renderuje `FeedbackTriggerButton` zamiast odnośnika.
      Kafelki: jedna kolumna na telefonie, dwie od `sm`; cele dotyku ≥ 44 px; kolory wyłącznie ze
      zmiennych CSS.
      *Gotowe, gdy:* „skorka" zawęża do jednej pozycji, „qqq" pokazuje stan pusty, a tryb wskazywania
      elementu dalej startuje z panelu. (AC-1, AC-6, AC-7, AC-8, AC-14, AC-15)

- [x] **T-7** `[P]` — `src/components/admin/PowrotDoPanelu.tsx`: wspólny odnośnik
      „‹ Panel administratora" (tekst ze słownika, `fontSize: 12` jak w istniejących), z opcjonalnym
      propem na odstęp — żeby podmiana nie przesuwała układu stron, które go już mają.
      *Gotowe, gdy:* komponent renderuje `a[href="/admin"]` i jest gotowy dla obu grup konsumentów.

- [x] **T-8** — `src/app/admin/przeglad/page.tsx` (nowa trasa): sesja + **własne** sprawdzenie
      `PERMISSIONS.ADMIN` z `redirect("/")`, jedenaście `count()`, karta buildu, dwie siatki
      liczników, karta sesji i `MetricCard` — treść przeniesiona **1:1** z dzisiejszego `/admin`,
      opakowana w `ModuleView` (`state="ready"`, `breadcrumb` → `/admin`).
      *Gotowe, gdy:* strona pokazuje wszystkie 5 pól buildu, 5 + 6 liczników i 3 pola sesji,
      a użytkownik bez uprawnienia jest odsyłany. (AC-5, AC-10, AC-13)

- [x] **T-9** — `src/app/admin/page.tsx` — **przepisanie**: sesja + uprawnienie, `ModuleView`
      (tytuł „Panel administratora", `state="ready"`) i `SpisNarzedziAdmina`. Znika karta buildu,
      jedenaście `count()`, sekcja konfiguracji, płaska lista, sekcja sesji i ręcznie rysowany `<h1>`.
      *Gotowe, gdy:* `grep` na `prisma.*count(` w tym pliku daje **zero** trafień, a strona ma
      dokładnie jeden `<h1>`. (AC-2, AC-4, AC-9, AC-11, AC-13)

- [x] **T-10** — Wpięcie `PowrotDoPanelu` w **3 strony bez powrotu**: `access`, `llm`,
      `user-facts`.
      *Korekta z implementacji (C-54):* pierwszy przegląd naliczył jedenaście braków, bo szukał
      odnośnika tylko w plikach tras — a trasy panelu to cienkie opakowania i odnośnik siedzi
      w komponencie z `src/components/admin/`. Przegląd idący **za renderem** daje 20 z 24 stron
      z powrotem i trzy braki. Szczegóły w planie §5.4.
      *Gotowe, gdy:* wszystkie 24 strony panelu mają widoczny odnośnik do `/admin`. (AC-12)

- [x] **T-11** — **Odpada** (C-54). Miała podmienić 12 ręcznych powrotów na wspólny komponent;
      w rzeczywistości jest ich dwadzieścia, w dwudziestu plikach, w różnych miejscach układu
      i pod różnymi etykietami („Admin" / „Panel admina"). Wszystkie działają, więc przepisywanie
      ich to osobna, świadoma zmiana, nie „przy okazji" (C-53). Rozjazd etykiet → obserwacja
      w `verify.md`.

- [x] **T-12** — Test jednostkowy uprawnienia: `legacyPermissionForPath` zwraca `module.admin` dla
      `/admin`, `/admin/przeglad` i pozostałych tras panelu — reguła, nie przypadek (plan §4).
      *Gotowe, gdy:* `test:unit` zielony. (AC-5)

## Faza 4 — AI / integracje

**Nie dotyczy** (plan §6): zero nowych `AIAction`, read-toolów i wpięć w kalendarz, powiadomienia
czy kosz. `check:actions`, `check:ai-coverage`, `check:cost-badge` sprawdzane w T-14 razem z buildem.

## Faza 5 — Klikacz, bramki i domknięcie

- [x] **T-13** — `e2e/specs/110-panel-admina.spec.ts`: testy AC-1…AC-16 wg mapowania z planu §8.
      AC-10 i AC-12 **pętlą po nazwach/trasach**, nie pojedynczym spojrzeniem. Asercje o BRAKU
      (AC-9) poprzedzone warunkiem pozytywnym — lekcja z 109. Bez `networkidle`.
      *Gotowe, gdy:* nowy spec zielony.

- [x] **T-14** — Bramki lokalnie na lokalnym Postgresie (C-13, **nigdy prod `DATABASE_URL`**):
      `check:admin-links` → `check:i18n` → `check:ui-contract` → `check:test-types` → `test:unit`
      → `next lint --dir src` → pełny `build` **do `next build`** (bez `scripts/migrate.js`).
      *Gotowe, gdy:* wszystko zielone. Jeśli `check:perf` zaprotestuje — podnieś próg
      w `perf-baseline.json` **z powodem**, nigdy po cichu.

- [ ] **T-15** — Uruchomienie klikacza (`nohup bash scripts/e2e-web.sh …`), w tym **bieg odniesienia
      na kodzie sprzed zmiany**, jeśli pojawią się czerwone testy poza nowym specem — bez niego nie da
      się odróżnić własnej regresji od cudzej (lekcja z 109).
      *Gotowe, gdy:* nowy spec zielony, a liczba czerwonych w pozostałych nie rośnie.

- [ ] **T-16** — Mapowanie każdego AC ze speca na wynik (wejście dla `/verify`).

- [ ] **T-17** — Wpis do `doświadczenia.md` (C-51): osierocona trasa `/admin/llm` bez odnośnika
      z żadnego miejsca w aplikacji i lekcja, dlaczego kompletności pilnuje **bramka**, a nie lista
      przepisana ręcznie.

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1 grupy z nazwą i opisem | T-2, T-3, T-6, T-13 |
| AC-2 nagłówek grupy widoczny z jej zawartością | T-6, T-9, T-13 |
| AC-3 każda trasa `/admin/*` ma odnośnik | T-2, **T-5 (bramka)**, T-13 |
| AC-4 narzędzie jednym kliknięciem | T-6, T-9, T-13 |
| AC-5 brak uprawnienia → odesłanie | T-8, T-9, T-12, T-13 |
| AC-6 wyszukiwarka prowadzi do narzędzia | T-6, T-13 |
| AC-7 szukanie bez diakrytyków | T-1, T-6, T-13 |
| AC-8 brak trafień → stan pusty | T-6, T-13 |
| AC-9 `/admin` bez buildu, liczników i sesji | T-9, T-13 |
| AC-10 przegląd niesie wszystkie dane | T-8, T-13, T-16 |
| AC-11 `/admin` bez zapytań zliczających | T-9, T-16 |
| AC-12 powrót z każdej strony panelu | T-7, T-10, T-13 |
| AC-13 rama widoku zamiast własnego nagłówka | T-8, T-9, T-13 |
| AC-14 kolory ze zmiennych | T-6, T-8, T-14 |
| AC-15 telefon: jedna kolumna, obszar gestów | T-6, T-13 |
| AC-16 teksty przez słownik | T-3, T-4, T-14 |

## Ścieżka krytyczna

`T-1 → T-2 → T-3 → T-6 → T-9` (rejestr → teksty → spis → wyrzutnia) · `T-2 → T-5` (bramka) ·
`T-7 → T-10` (powroty) · `T-8` niezależne od spisu, zależne od T-3 · wszystko →
`T-13 → T-14 → T-15 → T-16 → T-17`.
T-10 czeka na T-7.

## Notatki / blokady
- Brak.
