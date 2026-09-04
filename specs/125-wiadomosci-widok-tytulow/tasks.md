# Zadania: Wiadomości — widok samych tytułów do oznaczania „do doczytania"

- **Plan:** ./plan.md (125-wiadomosci-widok-tytulow)
- **Status:** todo
- **Data:** 2026-09-04

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Bez migracji i bez nowych akcji (plan §2–3), więc fazy danych/serwera nie ma —
> zaczynamy od komponentu. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Komponent wiersza
- [ ] **T-1** — `src/modules/news/ui/WierszTytulu.tsx` (nowy): pełnoszerokościowy `<button>`
  z `aria-pressed` i `py-3` (ikona `Bookmark`/`BookmarkCheck` + tytuł + `źródło · czas` przez
  `timeAgo`), OBOK osobny `<a target="_blank">` z `ExternalLink` do artykułu; `data-news-wiersz={id}`;
  kolory wyłącznie ze zmiennych CSS (`--accent-amber` dla stanu oznaczonego); teksty przez `t()`
  do `messages/pl.json`. Gotowe, gdy: `tsc --noEmit` i `check:i18n` zielone.

## Faza 1 — Wpięcie w strumień i stronę
- [ ] **T-2** — `NewsStream.tsx`: props `trybTytulow?: boolean` i
  `onPrzelaczDoczytanie?: (id: string, next: boolean) => void`; w `topic.items.map` przy
  `trybTytulow` render `WierszTytulu` zamiast `NewsItemCard` (kontener `data-news-item` zostaje).
  Nagłówek strumienia, sekcje, pusty stan, lektor — bez zmian. Gotowe, gdy: `tsc --noEmit` czysto,
  a przy `trybTytulow=false` render identyczny jak przed zmianą.
- [ ] **T-3** — `NewsPage.tsx`: (a) `tytuly: oneOf(["0","1"],"0")` w `viewSpec` + komentarz wzorca;
  (b) przycisk-przełącznik „Tytuły" (`List`, `aria-pressed`, etykieta ukryta poniżej `lg`, `py-3`)
  w pasku obok „Do doczytania"; (c) `przelaczDoczytanie(itemId, next)` — optymistyczny `setStream`
  + `setItemReadLater`, catch ⇒ `loadStream()` + toast; (d) w trybie tytułów przycisk
  „Do doczytania · N" ustawia `{ doczytania: "1", tytuly: "0" }` (przejście, nie toggle) i jest
  wyłączony przy N=0; (e) nowe teksty w `messages/pl.json`. Gotowe, gdy: `tsc --noEmit`
  i `check:i18n` zielone, URL niesie `tytuly=1`.

## Faza 2 — Bramki i domknięcie
- [ ] **T-4** — e2e `e2e/specs/125-wiadomosci-tytuly.spec.ts` (seed wg wzorca 124, tryb `serial`,
  upsert źródła na unikacie): AC-1 (przełącznik ⇒ wiersze zamiast kart, wyjście tym samym
  przyciskiem), AC-2 (klik wiersza ⇒ `aria-pressed`, trwałość po reloadzie), AC-3 (osobny link
  z `href`), AC-4 (przejście ⇒ `doczytania=1` bez `tytuly`, tylko oznaczone karty), AC-5 (licznik
  na bieżąco), AC-6 (wejście z `?tytuly=1`), AC-7 (360 px: wiersz ≥ 44 px, brak poziomego scrolla),
  AC-9 (filtr źródeł zawęża identycznie w obu trybach). Bez `networkidle`. Gotowe, gdy: nowy spec
  zielony ORAZ spec 124 zielony bez modyfikacji (AC-8).
- [ ] **T-5** — Pełne bramki: `check:i18n`, `tsc --noEmit`, `tsc -p tsconfig.test.json`,
  `next lint`, pełny `npm run build` na lokalnym Postgresie (env w DWÓCH liniach eksportu —
  lekcja 124). Gotowe, gdy: wszystko zielone.
- [ ] **T-6** — Mapowanie AC-1…AC-9 na wyniki (input do `/verify`) w tym pliku.
- [ ] **T-7** — Wpis do `doświadczenia.md`, jeśli po drodze był nieoczywisty problem (C-51);
  inaczej odnotować „bez nowych lekcji".

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 (widok tytułów jednym gestem) | T-2, T-3, T-4 |
| AC-2 (klik wiersza przełącza, trwałość) | T-1, T-3, T-4 |
| AC-3 (osobny cel do artykułu) | T-1, T-4 |
| AC-4 (przejście do odłożonych) | T-3, T-4 |
| AC-5 (licznik na bieżąco) | T-3, T-4 |
| AC-6 (stan w URL, ulubialny) | T-3, T-4 |
| AC-7 (telefon 360 px) | T-1, T-4 |
| AC-8 (zero zmian w 124) | T-2 (render za flagą), T-4 (spec 124 regresyjnie) |
| AC-9 (wspólny zbiór z filtrem źródeł) | T-2, T-4 |

## Notatki / blokady
- Ścieżka krytyczna: T-1 → T-2 → T-3 → T-4 → T-5; T-6/T-7 na końcu. Bez migracji i akcji —
  całość po stronie UI modułu.
