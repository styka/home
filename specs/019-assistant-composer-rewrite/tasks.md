# Zadania: Przepisanie kompozytora asystenta AI (układ jak „Chat with Claude")

- **Plan:** ./plan.md (019-assistant-composer-rewrite)
- **Status:** done
- **Data:** 2026-07-22

> **Zasada listy zadań:** zmiana czysto kliencka w jednym komponencie (`AICommandSheet.tsx`) — brak
> migracji, Server Actions, RBAC, AI. Zadania małe i weryfikowalne. Kolejność wg zależności w pliku.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- (brak) — feature nie rusza schematu ani migracji (plan §2). `npm run check:migrations` musi
  pozostać zielony.

## Faza 1 — Warstwa serwera / RBAC / AI
- (brak) — brak Server Actions, RBAC, AIAction (plan §3–§4, §6). `check:actions` zielony.

## Faza 2 — UI (wszystko w `worldofmag/src/components/home/AICommandSheet.tsx`)
Zależność: T-1 (import ikon) i T-2 (ukryte inputy) przed T-3 (karta); T-4 (ustawienia w nagłówku) i
T-5 (usunięcie menu „+") domykają przeniesienie; kolejność logiczna, ale wszystkie w jednym pliku.

- [x] **T-1** — **Import ikon.** Dodać do importu z `lucide-react`: `Camera`, `ArrowUp` (send jak
  strzałka w górę). Pozostałe (`ImagePlus`, `Mic`, `MicOff`, `AudioLines`, `Square`, `Settings`, `Plus`)
  bez zmian. *Gotowe, gdy:* import kompiluje, ikony dostępne.

- [x] **T-2** — **Dwa ukryte inputy zdjęć (aparat/galeria).** Obok istniejącego `fileRef`
  (`accept="image/*"`, galeria) dodać drugi ukryty input z `capture="environment"` (aparat) i osobny
  ref; oba `onChange={onPickImage}`. *Gotowe, gdy:* są dwa ukryte inputy → ten sam `onPickImage`.

- [x] **T-3** — **Karta dwuwierszowa kompozytora (rdzeń, AC-2/AC-3/AC-4/AC-1/AC-8).** Zastąpić
  jednowierszową „pigułkę" (~1470–1557) kartą kolumnową (`bg-elevated`, `border`, `border-radius`
  zaokrąglony, statyczny padding):
  - WIERSZ 1: `<textarea>` pełnej szerokości (ten sam `composerRef`/`value`/`onChange`/`onKeyDown`/
    `onFocus`/`onBlur`/`placeholder`/`rows=1`/`aria-label`), `fontSize:16`, `lineHeight:1.4`, padding
    pionowy mieszczący linię 16px, `minHeight` 1 linia, `maxHeight:140`, `overflowY:auto`,
    `caretColor:var(--accent-blue)`; auto-rozrost = istniejący `useEffect` na `scrollHeight`.
  - WIERSZ 2 (`justify-between`): lewo — przycisk **aparat** (`Camera`, „Zrób zdjęcie" → input z
    `capture`) i **galeria** (`ImagePlus`, „Dodaj zdjęcie" → `fileRef`); prawo — **mikrofon**
    (`dictation.toggle`, `Mic/MicOff`) + **główny przycisk** wg stanu: `busy`→Stop (`Square`,
    `accent-red`); tekst/obraz→**Wyślij** (`ArrowUp`, `accent-blue`, `var(--on-accent)`); puste→**głos**
    (`AudioLines`/`Square`, `accent-blue`). Kolory z tokenów (C-30), teksty/aria PL (C-32).
  *Gotowe, gdy:* kompozytor to karta 2-wierszowa; pole u góry nie przy dolnej krawędzi; główny przycisk
  zmienia się Stop/Wyślij/Głos; brak `env()` pod polem.

- [x] **T-4** — **Ikona „Ustawienia asystenta" w nagłówku (AC-5).** W prawym klastrze nagłówka
  (obok Nowa rozmowa/Historia/Zamknij) dodać przycisk `Settings` (`style=iconBtn`, `title/aria-label=
  "Ustawienia asystenta"`, `aria-expanded={showPrefs}`, kolor `accent-blue` gdy `prefs.trim()`)
  togglujący `setShowPrefs`. *Gotowe, gdy:* klik w nagłówku otwiera/zamyka panel `showPrefs`.

- [x] **T-5** — **Usunięcie menu „+" i stanu `showPlus`.** Wyciąć przycisk „+", jego popover i pozycje
  („Zdjęcie", „Ustawienia asystenta") oraz stan `showPlus`/`setShowPlus`. Funkcje przeniesione: zdjęcia
  → wiersz akcji (T-3), ustawienia → nagłówek (T-4). *Gotowe, gdy:* brak odwołań do `showPlus`; brak
  martwego kodu; kompozytor bez menu „+".

## Faza 3 — AI / integracje
- (brak) — plan §6: nie dotyczy.

## Faza 4 — Bramki i domknięcie
- [x] **T-6** — **Bramki jakości (C-50).** Z `worldofmag/`: `npm run check:migrations`,
  `npm run check:actions`, `next lint --dir src`, `next build` (lokalny Postgres — C-13; **nie**
  `migrate.js`). *Gotowe, gdy:* wszystkie zielone do `next build`; brak nowych błędów lint.
- [x] **T-7** — **Mapowanie AC → wynik** (input do `/verify`): AC-1/AC-8→T-3 (+stopka warunkowa),
  AC-2→T-3, AC-3→T-3, AC-4→T-2/T-3, AC-5→T-4, AC-6→(brak przeliczeń na scroll), AC-7→zachowane
  handlery, AC-9→autofokus/wysyłka bez zmian. Żaden AC bez pokrycia.
- [x] **T-8** — **Wpis do `doświadczenia.md`** (C-51): lekcja o strukturalnej naprawie karetki (pole u
  góry karty, wiersz akcji pod nim, brak `env()`/dynamicznego insetu pod fokusowanym polem) i o
  przepisaniu kompozytora na układ „Chat with Claude".

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (karetka od razu w polu, iOS) | T-3 (układ) + stopka warunkowa |
| AC-2 (auto-rozrost pola) | T-3 |
| AC-3 (układ dwuwierszowy) | T-3 |
| AC-4 (akcje w dolnym wierszu: aparat/galeria/mikrofon/główny) | T-2, T-3 |
| AC-5 (ustawienia w nagłówku) | T-4, T-5 |
| AC-6 (płynne przewijanie) | T-3 (brak przeliczeń wysokości na scroll) |
| AC-7 (zachowana funkcjonalność) | T-3 (te same handlery), T-6 |
| AC-8 (kreska iPhone bez psucia karetki) | T-3 + stopka `composerFocused`-warunkowa |
| AC-9 (desktop bez regresji) | T-3, T-6 |

## Notatki / blokady
- Weryfikacja zachowania karetki na iOS jest niemożliwa w sandboxie — po zielonym buildzie i merge do
  `develop` wymaga testu właściciela na urządzeniu przed promocją na `master`.
