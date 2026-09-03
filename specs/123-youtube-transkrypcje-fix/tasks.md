# Zadania: Transkrypcje YouTube — naprawa pobierania

- **Plan:** ./plan.md (123-youtube-transkrypcje-fix)
- **Status:** done
- **Data:** 2026-09-03

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → lib → job → testy → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- [x] **T-1** — Migracja danych `prisma/migrations/0289_youtube_transkrypcje_ponowna_proba/migration.sql`
  (UPDATE „niedostepna" → „oczekuje" wg planu §2; bez zmian w `schema.prisma`). Gotowe, gdy
  `npm run check:migrations` przechodzi, a na lokalnym Postgresie `npx prisma migrate deploy`
  aplikuje ją czysto i stan wierszy zmienia się zgodnie z oczekiwaniem (AC-3).

## Faza 1 — Warstwa lib modułu (rdzeń naprawy)
- [x] **T-2** — `lib/transkrypcja.ts`: rozszerz `PobierzTresc` o opcjonalny `init` (wstecznie
  zgodnie), dodaj funkcje czyste `sciezkiNapisowZPlayerResponse`, `tekstZPanelu`, `paramsPanelu`
  oraz pole `zrodlo` w `Transkrypcja`. Gotowe, gdy funkcje są eksportowane, czyste (zero I/O)
  i `tsc` przechodzi.
- [x] **T-3** — `lib/transkrypcja.ts`: przebuduj `pobierzTranskrypcje` na łańcuch trzech dróg
  (strona → player[ANDROID] → panel get_transcript) wg planu §1; pusty tekst na dowolnym etapie =
  przejście do następnej drogi; wszystkie niepowodzenia = `null`, nic nie rzuca (AC-1, AC-4, AC-5).
  Gotowe, gdy łańcuch działa na wstrzykniętym fetcherze (sprawdzone testem z T-5).
- [x] **T-4** `[P]` — `jobs/youtubeRefresh.ts`: w istniejącym logu
  `youtube.transkrypcje.skutecznosc` dodaj rozbicie zliczeń po `zrodlo` (AC-6). Gotowe, gdy log
  emituje pola `probowano/udane/odsetek` + płaskie `zrodloStrona/zrodloPlayer/zrodloPanel`
  (korekta z review: `oczysc` spłaszcza obiekty, więc zagnieżdżone `zrodla` gubiłoby liczby —
  ślad C-54) i `tsc` przechodzi.

## Faza 2 — Testy jednostkowe (próbki obecnych odpowiedzi)
- [x] **T-5** — `lib/__tests__/transkrypcja.test.ts`: dopisz próbki i testy — (a) player response
  ANDROID → ścieżki + preferencja językowa; (b) odpowiedź `get_transcript` → złożony tekst;
  (c) **pusty timedtext** → łańcuch spada do kolejnej drogi; (d) wszystkie drogi padają → `null`,
  nic nie rzuca; (e) `paramsPanelu` daje stabilny, poprawny base64 (parametr idzie w ciele JSON, więc wariant URL-safe nie jest potrzebny — korekta względem planu §3, ślad C-54); (f) `pobierzTranskrypcje`
  na wstrzykniętym fetcherze zwraca tekst + `zrodlo` (AC-2, AC-4, AC-5). Gotowe, gdy
  `npm run test:unit` (lub celowany `node --test`) zielony.

## Faza 3 — AI / integracje
- Nie dotyczy (plan §6): konsumenci czytają kolumnę `transkrypcja` bez zmian; przegląd kodu
  konsumentów wykonuje `/verify` przy AC-7.

## Faza 4 — Bramki i domknięcie
- [x] **T-6** — Pełna weryfikacja lokalna: `npm run test:unit`, `next lint --dir src`,
  build do `next build` włącznie na lokalnym Postgresie (C-13 — bez `migrate.js` na prod). Gotowe,
  gdy wszystko zielone.
- [x] **T-7** — Mapowanie AC → wynik (input do `/verify`); aktualizacja statusów w artefaktach.
- [x] **T-8** — Wpis do `doświadczenia.md` (C-51): przyczyna (POT na timedtext, pusty 200 ≠ brak
  napisów, „niedostepna" bez ponawiania utrwala usterkę) + commit razem z fixem.

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 (film z napisami dostaje transkrypcję) | T-3, T-5(f); pełne potwierdzenie po deployu `develop` (plan §8) |
| AC-2 (testy na próbkach obecnych odpowiedzi) | T-5 |
| AC-3 (rekwalifikacja „niedostepna") | T-1 |
| AC-4 (brak napisów = stan, nie awaria) | T-3, T-5(c,d) |
| AC-5 (preferencja pl→en, autorskie>auto) | T-3, T-5(a) — reużycie `wybierzSciezke` |
| AC-6 (log skuteczności) | T-4 |
| AC-7 (Notatki/Fiszki korzystają z transkrypcji) | przegląd kodu w `/verify` (bez zmian kodu) |

## Notatki / blokady
- Ścieżka krytyczna: T-2 → T-3 → T-5 → T-6. T-1 i T-4 niezależne (można równolegle).
- Sandbox nie widzi youtube.com (proxy 403) — weryfikacja „na żywo" wyłącznie po deployu na
  `develop`, przez log `youtube.transkrypcje.skutecznosc` (plan §1, §8).
