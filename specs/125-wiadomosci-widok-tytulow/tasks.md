# Zadania: Wiadomości — widok samych tytułów do oznaczania „do doczytania"

- **Plan:** ./plan.md (125-wiadomosci-widok-tytulow)
- **Status:** done
- **Data:** 2026-09-04

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Bez migracji i bez nowych akcji (plan §2–3), więc fazy danych/serwera nie ma —
> zaczynamy od komponentu. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Komponent wiersza
- [x] **T-1** — `src/modules/news/ui/WierszTytulu.tsx` (nowy): pełnoszerokościowy `<button>`
  z `aria-pressed` i `py-3` (ikona `Bookmark`/`BookmarkCheck` + tytuł + `źródło · czas` przez
  `timeAgo`), OBOK osobny `<a target="_blank">` z `ExternalLink` do artykułu; `data-news-wiersz={id}`;
  kolory wyłącznie ze zmiennych CSS (`--accent-amber` dla stanu oznaczonego); teksty przez `t()`
  do `messages/pl.json`. Gotowe, gdy: `tsc --noEmit` i `check:i18n` zielone.

## Faza 1 — Wpięcie w strumień i stronę
- [x] **T-2** — `NewsStream.tsx`: props `trybTytulow?: boolean` i
  `onPrzelaczDoczytanie?: (id: string, next: boolean) => void`; w `topic.items.map` przy
  `trybTytulow` render `WierszTytulu` zamiast `NewsItemCard` (kontener `data-news-item` zostaje).
  Nagłówek strumienia, sekcje, pusty stan, lektor — bez zmian. Gotowe, gdy: `tsc --noEmit` czysto,
  a przy `trybTytulow=false` render identyczny jak przed zmianą.
- [x] **T-3** — `NewsPage.tsx`: (a) `tytuly: oneOf(["0","1"],"0")` w `viewSpec` + komentarz wzorca;
  (b) przycisk-przełącznik „Tytuły" (`List`, `aria-pressed`, etykieta ukryta poniżej `lg`, `py-3`)
  w pasku obok „Do doczytania"; (c) `przelaczDoczytanie(itemId, next)` — optymistyczny `setStream`
  + `setItemReadLater`, catch ⇒ `loadStream()` + toast; (d) w trybie tytułów przycisk
  „Do doczytania · N" ustawia `{ doczytania: "1", tytuly: "0" }` (przejście, nie toggle) i jest
  wyłączony przy N=0; (e) nowe teksty w `messages/pl.json`. Gotowe, gdy: `tsc --noEmit`
  i `check:i18n` zielone, URL niesie `tytuly=1`.

## Faza 2 — Bramki i domknięcie
- [x] **T-4** — e2e `e2e/specs/125-wiadomosci-tytuly.spec.ts` (seed wg wzorca 124, tryb `serial`,
  upsert źródła na unikacie): AC-1 (przełącznik ⇒ wiersze zamiast kart, wyjście tym samym
  przyciskiem), AC-2 (klik wiersza ⇒ `aria-pressed`, trwałość po reloadzie), AC-3 (osobny link
  z `href`), AC-4 (przejście ⇒ `doczytania=1` bez `tytuly`, tylko oznaczone karty), AC-5 (licznik
  na bieżąco), AC-6 (wejście z `?tytuly=1`), AC-7 (360 px: wiersz ≥ 44 px, brak poziomego scrolla),
  AC-9 (filtr źródeł zawęża identycznie w obu trybach). Bez `networkidle`. Gotowe, gdy: nowy spec
  zielony ORAZ spec 124 zielony bez modyfikacji (AC-8).
- [x] **T-5** — Pełne bramki: `check:i18n`, `tsc --noEmit`, `tsc -p tsconfig.test.json`,
  `next lint`, pełny `npm run build` na lokalnym Postgresie (env w DWÓCH liniach eksportu —
  lekcja 124). Gotowe, gdy: wszystko zielone.
- [x] **T-6** — Mapowanie AC-1…AC-9 na wyniki (input do `/verify`) w tym pliku.
- [x] **T-7** — Wpis do `doświadczenia.md`, jeśli po drodze był nieoczywisty problem (C-51);
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

## Wyniki AC (T-6 — input do /verify)
| AC | Wynik | Dowód |
|----|-------|-------|
| AC-1 | ✅ e2e | [125-AC1..AC5]: klik „Tytuły" ⇒ URL `tytuly=1`, 0 kart, wiersze wszystkich trzech pozycji; wyjście tym samym przyciskiem (aria-pressed) |
| AC-2 | ✅ e2e | [125-AC1..AC5]: klik wiersza ⇒ `aria-pressed=true` natychmiast; twardy reload ⇒ stan trwały; drugi klik odznacza |
| AC-3 | ✅ e2e | [125-AC1..AC5]: osobny `<a href=…>` na wierszu; klik wiersza nie nawiguje |
| AC-4 | ✅ e2e | [125-AC1..AC5]: „Przejdź do odłożonych" ⇒ `doczytania=1` bez `tytuly`, karta odłożonej jest, zwykłej nie ma |
| AC-5 | ✅ e2e | [125-AC1..AC5]: licznik na przycisku przejścia rośnie/maleje od razu po kliku (optymistyka) |
| AC-6 | ✅ e2e | [125-AC6]: wejście z `?tytuly=1` ⇒ wiersze, przełącznik wciśnięty |
| AC-7 | ✅ e2e | [125-AC7]: 360 px — wiersz ≥ 44 px, brak poziomego przewijania |
| AC-8 | ✅ e2e | spec 124 bez modyfikacji scenariuszy: 3/3 zielone w tym samym przebiegu |
| AC-9 | ✅ e2e | [125-AC9]: `?zrodla=e2e-125a` daje te same pozycje w wierszach i w kartach (źródło B odsiane w obu) |

E2E: 10/10 zielone (`scripts/e2e-web.sh --workers=1 e2e/specs/125-… e2e/specs/124-…`, desktop).

T-7: bez nowych lekcji do doświadczenia.md — jedyny niebanalny problem (globalne liczniki
w współdzielonej bazie e2e + globalne „Oznacz wszystkie" między plikami) jest odnotowany niżej
i w komentarzach speca e2e; to wariant lekcji już opisanej przy 124 (wyścig sejdów).

## Notatki / blokady
- E2E 125+124 uruchamiane razem z `--workers=1`: spec 124 wykonuje globalne „Oznacz wszystkie"
  (akcja obejmuje wszystkie tematy konta e2e-admin), więc równoległy worker zjadałby pozycje
  seedowane przez 125 — wyścig międzyplikowy, nie do wykrycia w pojedynczych przebiegach.
- Ścieżka krytyczna: T-1 → T-2 → T-3 → T-4 → T-5; T-6/T-7 na końcu. Bez migracji i akcji —
  całość po stronie UI modułu.
