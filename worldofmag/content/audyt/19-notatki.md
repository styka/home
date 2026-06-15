# Rozdział 19 — Notatki (Notes)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/notes.ts`, `noteGroups.ts`, `tags.ts`; modele `Note`, `NoteGroup`, `Tag`,
  `NoteTag`, `NoteRevision`, `NoteAttachment`.
- **Funkcje:** live-preview markdown (`src/lib/markdown.ts`), **wikilinki `[[Tytuł]]`** + backlinki
  (`src/lib/wikilinks.ts`, testowane), ważone wyszukiwanie pełnotekstowe, załączniki/obrazy, **historia
  wersji** (`NoteRevision`, przywracanie).
- **Renderer** wspólny z raportami/QA/AI — bezpieczny (escaping, brak surowego HTML).

## Mocne strony

- **Wikilinki + backlinki** — „mini-Obsidian” w jednej aplikacji do wszystkiego; rzadkość.
- **Wersjonowanie + załączniki** — poważne funkcje notatnika.
- **Bezpieczny renderer** (pokryty testami regresji XSS — Z-179).

## Głos Zespołu A — Strażnicy

**Marek (DBA):** „**Wyszukiwanie jest aplikacyjne**, nie pełnotekstowe w bazie. Przy 50 notatkach OK,
przy 5000 — skanuje wszystko po stronie serwera. Przy skali → **Postgres FTS** (`tsvector` + GIN) albo
indeks. To wąskie gardło ukryte za »działa«.”

**Anna (security):** „Załączniki — gdzie lądują i jak są serwowane? Trzeba potwierdzić autoryzację
dostępu do plików notatek (anty-IDOR, Z-052) i limity rozmiaru.”

## Głos Zespołu B — Pionierzy

**Hubert (AI/ML):** „Notatki to **idealne źródło dla AI**: »podsumuj«, »znajdź powiązane«, »zrób z tego
zadania«. Mamy wikilinki — dołóżmy **AI-sugestie linków** (»ta notatka pasuje do [[X]]«). To buduje graf
wiedzy automatycznie.”

**Ola (UX):** „**Widok grafu** notatek (jak Obsidian) byłby spektakularny wizualnie i marketingowo.”

## Punkty sporne

- **FTS teraz vs przy skali.** **Konsensus:** przejść na Postgres FTS, gdy notatki przekroczą próg
  (np. setki/usera) — zaplanować, nie budować na zapas, ale **przed** marketingiem dla power-userów.

## Głos użytkowników

**Marek (29):** „Używam jak Obsidiana — chcę graf i AI do łączenia notatek.”

## Konsensus i zalecenia

- **Z-240** *(P1 · M)* — **Wyszukiwanie pełnotekstowe w Postgres** (`tsvector` + GIN) zamiast skanu
  aplikacyjnego — warunek skali dla power-userów.
- **Z-241** *(P1 · S)* — **Potwierdzić autoryzację i limity załączników** (anty-IDOR, rozmiar) — spójne z Z-052.
- **Z-242** *(P2 · M)* — **AI-sugestie wikilinków** („ta notatka pasuje do [[X]]”) — automatyczny graf wiedzy.
- **Z-243** *(P2 · M)* — **Widok grafu notatek** — atut wizualny/marketingowy.
- **Z-244** *(P2 · S)* — **AI-akcje na notatce** (podsumuj / zrób zadania) — spięcie z agentem.

## Dobre vs złe praktyki

**Dobre:** wikilinki+backlinki, wersjonowanie, bezpieczny renderer, testy.
**Złe / do poprawy:** wyszukiwanie aplikacyjne (nie FTS) — ryzyko skali; potwierdzić bezpieczeństwo załączników.
