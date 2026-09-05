# Plan techniczny: Wiadomości — widok samych tytułów do oznaczania „do doczytania"

- **Spec:** ./spec.md (125-wiadomosci-widok-tytulow)
- **Status:** draft
- **Data:** 2026-09-04

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście (2–4 zdania)

Wzorcem jest sam moduł Wiadomości po 124 — widok tytułów to **trzeci klucz trybu w istniejącym
`viewState`** (obok `czytanie` i `doczytania`), a nie nowa podstrona: `NewsPage` dostaje
`tytuly: "0"|"1"` w adresie, a `NewsStream` w trybie tytułów podmienia JEDNO miejsce — render
pozycji w `topic.items.map` — z `NewsItemCard` na nowy, lekki `WierszTytulu`. Sekcje tematów,
nawigator, filtr źródeł, akcje sekcji, pusty stan i lektor zostają bez zmian, bo oba tryby rysują
TEN SAM zbiór `widoczneWiadomosci` (lekcja 085). Oznaczenie na wierszu robi **optymistyczną** zmianę
stanu strumienia w `NewsPage` + wywołuje istniejące `setItemReadLater` z 124 — zero nowych akcji.

## 2. Model danych (Prisma)

**Bez zmian w schemacie** — feature konsumuje `NewsItem.readLater` z migracji 0290 (124).
Żadnej migracji.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych akcji i bez zmian istniejących.** Wiersz tytułu woła `setItemReadLater(itemId, next)`
(guard i `revalidatePath` z 124). Optymistyka jest kliencka:

- `NewsPage` dostaje `przelaczDoczytanie(itemId, next)`: najpierw `setStream` przepisuje
  `readLater` pozycji w stanie (licznik w pasku, filtr i nawigator liczą z tego samego stanu, więc
  wszystko aktualizuje się natychmiast — AC-5), potem `await setItemReadLater`; błąd ⇒ `loadStream()`
  (powrót do prawdy serwera) + toast. Bez `router.refresh()` na sukcesie — triage to seria szybkich
  dotknięć i pełny odświeżacz po każdym byłby dokładnie tym „komplikowaniem", którego spec zakazuje;
  ścieżka karty (124) zostaje przy swoim `onChanged`.

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: `module.news`, żadnych nowych tras ani wpisów.

## 5. UI (C-30, C-31, C-32)

- **`NewsPage.tsx`:**
  - `viewSpec` + `tytuly: oneOf(["0", "1"] as const, "0")` (AC-6 — ulubialność, wzorzec
    `czytanie`/`doczytania`).
  - Nowy przycisk-przełącznik w pasku przyklejonym (obok „Do doczytania"): ikona `List`,
    etykieta „Tytuły" (ukryta poniżej `lg`), `aria-pressed`, stała wysokość `py-3` (083/100).
    Wejście i wyjście tym samym przyciskiem (AC-1).
  - **Przycisk „Do doczytania · N" w trybie tytułów staje się PRZEJŚCIEM** (AC-4): klik ustawia
    `{ doczytania: "1", tytuly: "0" }` — jeden gest z triage'u do pełnego widoku samych odłożonych
    (dokładnie zawężenie z 124, z lektorem). Poza trybem tytułów zachowuje się jak w 124 (toggle
    filtra). Jedna kontrolka, dwa spójne znaczenia „pokaż odłożone" — zero nowych elementów paska.
  - `przelaczDoczytanie` (pkt 3) przekazane do `NewsStream`; `trybTytulow` jako prop.
  - Filtr `doczytania` w trybie tytułów działa na tym samym zbiorze bez specjalnych przypadków
    (AC-9 — filtrowanie zostaje tam, gdzie jest).
- **`NewsStream.tsx`:** props `trybTytulow?: boolean`, `onPrzelaczDoczytanie?: (id, next) => void`;
  w `topic.items.map` przy trybie tytułów renderuje `WierszTytulu` zamiast `NewsItemCard`
  (kontener `data-news-item` zostaje — obserwator sekcji i przewijanie nie widzą różnicy).
  Nagłówek strumienia („Nowych wiadomości: N…", „Oznacz wszystkie"), sekcje, pusty stan — bez zmian.
- **`WierszTytulu.tsx` (nowy, `src/modules/news/ui/`):** jeden wiersz = jeden `<button>`
  pełnej szerokości (`aria-pressed`, min. `py-3` — AC-7): ikona stanu (`Bookmark`/`BookmarkCheck`,
  akcent `var(--accent-amber)` jak w 124), tytuł (zawijany, `font-medium`), pod nim
  `źródło · czas` (`text-xs`, `var(--text-muted)`, `timeAgo` — jak na karcie); po prawej **osobny**
  `<a>` z `ExternalLink` (AC-3: otwarcie artykułu nie przełącza oznaczenia — `stopPropagation`
  zbędne, bo link stoi OBOK przycisku, nie w nim). Oznaczona pozycja: wypełniona ikona + tytuł
  w `var(--text-primary)` z lewym akcentem; nieoznaczona: neutralna. Tylko zmienne CSS (C-30).
  `data-news-karta` tu NIE dajemy (to uchwyt karty pełnej); wiersz dostaje własny
  `data-news-wiersz={id}` dla e2e.
- **Teksty (C-32):** nowe klucze w `messages/pl.json` (`modules.news.NewsPage.tytuly*`,
  `modules.news.WierszTytulu.*`: „Tytuły", „Widok samych tytułów", „Oznacz do doczytania",
  „Otwórz artykuł" itd.).

## 6. AI / integracje (C-23, C-40)

Nie dotyczy — żadnych nowych `AIAction`, wywołań modeli ani wpisów w manifestach
(`action-coverage` bez zmian, bo akcja jest ta sama co w 124).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/news/ui/WierszTytulu.tsx` | nowy | kompaktowy wiersz tytułu: przycisk-przełącznik + link do artykułu |
| `src/modules/news/ui/NewsPage.tsx` | edycja | klucz `tytuly` w viewState, przycisk trybu, przejście „do odłożonych", `przelaczDoczytanie` (optymistyka) |
| `src/modules/news/ui/NewsStream.tsx` | edycja | props `trybTytulow`/`onPrzelaczDoczytanie`, podmiana renderu pozycji |
| `messages/pl.json` | edycja | nowe teksty |
| `e2e/specs/125-wiadomosci-tytuly.spec.ts` | nowy | klikacz AC-1..AC-7, AC-9 (seed wg wzorca 124) |
| `doświadczenia.md` | edycja (warunkowo) | wpis C-51, jeśli wyjdzie nieoczywisty problem |

## 8. Bramki i weryfikacja (C-50)

- Bez migracji ⇒ bramki bazodanowe bez zmian; lokalnie: `tsc --noEmit`, `check:i18n`,
  `next lint`, pełny `npm run build` na lokalnym Postgresie (C-13; env eksportowany w DWÓCH
  liniach — lekcja z 124: `export A=… B="$A"` w jednej linii daje puste B).
- e2e: `scripts/e2e-web.sh e2e/specs/125-wiadomosci-tytuly.spec.ts` + regresyjnie
  `124-wiadomosci-doczytania.spec.ts` (AC-8).
- Mapowanie AC → sposób sprawdzenia:
  - **AC-1** — e2e: klik przełącznika ⇒ URL `tytuly=1`, brak pełnych kart (`[data-news-karta]`
    count 0), są wiersze (`[data-news-wiersz]`), sekcje tematów obecne; drugi klik wychodzi.
  - **AC-2** — e2e: klik wiersza ⇒ `aria-pressed=true` + trwałość (reload strony ⇒ stan zostaje);
    drugi klik odznacza.
  - **AC-3** — e2e: link artykułu jest osobnym elementem z `href` pozycji; klik wiersza nie
    nawiguje (URL bez zmian poza `tytuly`).
  - **AC-4** — e2e: klik „Do doczytania · N" w trybie tytułów ⇒ URL `doczytania=1` bez `tytuly=1`,
    widoczne tylko oznaczone karty pełne.
  - **AC-5** — e2e: licznik na przycisku rośnie/maleje natychmiast po kliku wiersza.
  - **AC-6** — e2e: wejście z `?tytuly=1` odtwarza widok tytułów.
  - **AC-7** — e2e viewport 360: wysokość wiersza ≥ 44 px, brak poziomego przewijania.
  - **AC-8** — regresyjnie: spec 124 zielony bez zmian scenariuszy.
  - **AC-9** — e2e: filtr źródeł zawęża identycznie w obu trybach (licznik sekcji ten sam).

## 9. Ryzyka techniczne i plan wycofania

- **Optymistyka rozjedzie się z serwerem przy błędzie akcji** → catch robi `loadStream()` (powrót
  do prawdy serwera) + toast; stan optymistyczny żyje wyłącznie w `stream`, więc nie ma drugiego
  nośnika do uzgadniania.
- **Przypadkowy klik wiersza przy przewijaniu** → wiersz to `<button>` (klik, nie hover/gest),
  odwracalny tym samym dotknięciem; brak potwierdzeń (nic nie niszczy).
- **Regres 124** → spec 124 w suicie bez modyfikacji; podmiana renderu jest za flagą, domyślnie
  wyłączoną (`tytuly=0` ⇒ kod 124 nietknięty).
- **Rollback:** czysty revert commitów (zero migracji).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — nie dotyczy (bez zmian schematu), zapisane wprost
- [x] C-20..C-25 — bez nowych mutacji; istniejąca akcja z guardem i `revalidatePath` (124)
- [x] C-30..C-33 — zmienne CSS, cele dotyku `py-3`, stała wysokość paska, stan w URL,
  stany brzegowe przez istniejący mechanizm strumienia; teksty przez `t()` (C-32)
- [x] C-53 — minimalizm zamówiony wprost: 1 nowy komponent, 2 edycje, 0 akcji, 0 migracji;
  przejście „do odłożonych" reużywa istniejący przycisk zamiast dokładać nowy element paska
