# Weryfikacja: Wiadomości — widok samych tytułów do oznaczania „do doczytania"

- **Spec:** ./spec.md (125-wiadomosci-widok-tytulow)
- **Data:** 2026-09-05

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run build` (pełny łańcuch, lokalny Postgres `worldofmag_e2e`) | ✅ 40 bramek zielonych, w tym `check:migrations` („następny wolny numer: 0291" — 125 nie dodaje migracji), `check:actions` (168 akcji), `check:ai-coverage`, `check:i18n`, `check:pagination`, `check:ui-contract`, `check:e2e-waits` |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" |
| `tsc --noEmit` + `tsc -p tsconfig.test.json` + `tsc -p e2e/tsconfig.json` | ✅ czysto |
| `next build` + `check:perf-budget` | ✅ suma 74801 kB — w paśmie ±5 % (wzrost o 3 kB względem 124: nowy komponent wiersza) |
| `scripts/migrate.js` (ostatni krok) | ✅ EXIT=0 na lokalnym Postgresie (pierwsze podejście padło, bo skrypt e2e zatrzymał klaster po swoim przebiegu — po `pg_ctlcluster 16 main start` czysto; bez zmian w migracjach, więc krok był czystym re-deployem 0290 i seedem) |
| e2e `scripts/e2e-web.sh --workers=1 125 + 124` | ✅ **10/10** (desktop): 125 — 4 scenariusze, 124 — 3 scenariusze regresyjnie, bez modyfikacji |

## Kryteria akceptacji

- **AC-1 (widok samych tytułów jednym gestem, te same tematy i nawigator)** — ✅ *e2e
  [125-AC1..AC5]*: klik „Tytuły" ⇒ URL `tytuly=1`, zero pełnych kart (`[data-news-karta]` = 0),
  wiersze wszystkich trzech seedowanych pozycji; wyjście tym samym przyciskiem (`aria-pressed`).
  W kodzie: tryb podmienia wyłącznie render pozycji w `topic.items.map` (`NewsStream.tsx`), sekcje
  i `GroupNavigator` nietknięte.
- **AC-2 (klik wiersza przełącza, stan widoczny i trwały)** — ✅ *e2e*: klik ⇒ `aria-pressed=true`
  natychmiast (optymistyka), twardy `reload` ⇒ stan utrzymany (zapis przez `setItemReadLater`
  z 124 — ten sam znacznik wszędzie); drugi klik odznacza.
- **AC-3 (osobny cel do artykułu)** — ✅ *e2e*: `<a href="…">` stoi OBOK przycisku wiersza
  (`WierszTytulu.tsx` — link nie jest dzieckiem przycisku, więc klik wiersza nie nawiguje).
- **AC-4 (jedno przejście do widoku odłożonych)** — ✅ *e2e*: „Przejdź do odłożonych" ⇒ URL
  `doczytania=1` bez `tytuly=1`, karta pozycji odłożonej widoczna, nieodłożonej nie ma — czyli
  dokładnie zawężenie z 124 (lektor po odfiltrowanych działa tam bez zmian — AC-8).
- **AC-5 (licznik na bieżąco)** — ✅ *e2e*: licznik na przycisku przejścia zmienia się od razu po
  kliku wiersza; w kodzie licznik liczy z tego samego stanu `stream`, który optymistyka przepisuje.
- **AC-6 (stan w URL, ulubialny)** — ✅ *e2e [125-AC6]*: wejście z `?tytuly=1` odtwarza widok
  (wiersze + wciśnięty przełącznik); klucz w tym samym `viewState` co `czytanie`/`doczytania`.
- **AC-7 (telefon 360 px)** — ✅ *e2e [125-AC7]*: wiersz ≥ 44 px wysokości (`py-3`), strona bez
  poziomego przewijania; etykieta przełącznika chowa się do ikony poniżej `lg`.
- **AC-8 (zero zmian w 124)** — ✅ spec `124-wiadomosci-doczytania` przeszedł 3/3 w tym samym
  przebiegu **bez modyfikacji scenariuszy**; render kart za flagą `trybTytulow` (domyślnie off),
  akcje/filtr/lektor nietknięte.
- **AC-9 (wspólny zbiór z filtrem źródeł)** — ✅ *e2e [125-AC9]*: `?zrodla=e2e-125a` daje te same
  pozycje w trybie tytułów (wiersze) i pełnym (karty) — pozycja ze źródła B odsiana w obu;
  w kodzie filtr działa PRZED wyborem sposobu renderowania.

## Zgodność z konstytucją

- **C-01/C-02/C-36** ✅ — całość w `src/modules/news/`, importy własnego wnętrza względne.
- **C-10..C-14** ✅ — bez zmian schematu i migracji (zapisane wprost w planie §2).
- **C-20/C-21** ✅ — zero nowych mutacji; wiersz woła `setItemReadLater` z guardem z 124;
  optymistyka kliencka nie omija serwera (błąd ⇒ powrót do prawdy serwera + toast).
- **C-30/C-31/C-32/C-33** ✅ — wyłącznie zmienne CSS (amber przez `--accent-amber`, inset-shadow
  z var), cele dotyku pełnowierszowe `py-3`, teksty przez `t()` (bramka zielona), stany brzegowe
  przez istniejący mechanizm strumienia; pasek stałej wysokości (przełącznik jak sąsiedzi).
- **C-34** ✅ — brak potwierdzeń (nic nie niszczy; gest odwracalny).
- **C-53** ✅ — 1 nowy komponent + 2 edycje + teksty; zero migracji, akcji, zależności; przejście
  „do odłożonych" reużywa istniejący przycisk zamiast dokładać element paska.

## Regresje

- **Tryb wyłączony = kod 124 nietknięty**: `trybTytulow=false` renderuje dokładnie to, co przed
  zmianą (podmiana jest gałęzią w jednym miejscu); potwierdzone regresyjnym przebiegiem specu 124.
- **Lektor/`Oznacz wszystkie`/sekcje**: w trybie tytułów przyciski sekcji (słuchaj tematu, oznacz
  temat) działają bez zmian — konsumują ten sam zbiór.
- **Karta pełna zachowuje „Doczytam"** (decyzja ze speca §8) — widok tytułów jest szybszą drogą,
  nie jedyną.
- **Suita e2e**: przy wspólnym przebiegu wielu plików Wiadomości wymagany `--workers=1`
  (globalne „Oznacz wszystkie" + współdzielona baza — odnotowane w tasks.md i komentarzach speców);
  asercje 125 zakresowane po tytułach, seed resetuje cudze odłożenia.

## Werdykt końcowy

**GOTOWE** — 9/9 AC spełnionych z dowodami e2e/kodem, wszystkie bramki zielone łącznie z pełnym
buildem i `migrate.js` na lokalnym Postgresie; bez uwag blokujących i bez zmian schematu.
