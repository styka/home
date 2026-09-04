# Recenzja: Transkrypcje YouTube — naprawa pobierania

- **Spec:** ./spec.md (123-youtube-transkrypcje-fix)
- **Data:** 2026-09-03
- **Zakres diffa:** `origin/develop...HEAD` — moduł YouTube (`lib/transkrypcja.ts` + testy,
  `jobs/youtubeRefresh.ts`), migracja danych 0289, artefakty speca, `doświadczenia.md`.

## Ustalenia (od najpoważniejszego)

1. **`jobs/youtubeRefresh.ts` (log skuteczności) — correctness — NAPRAWIONE w review.**
   Rozbicie zliczeń po źródle było logowane jako zagnieżdżony obiekt `zrodla`, a `oczysc` w
   `platform/observability/log.ts:88` spłaszcza każdy obiekt do `"[obiekt N pól]"`. Scenariusz
   awarii: po deployu log pokazuje `zrodla: "[obiekt 1 pól]"` — liczniki giną i nie da się
   odpowiedzieć „która droga niesie ruch", czyli dokładnie tego, po co pole powstało (AC-6, jedyna
   droga weryfikacji AC-1 na żywo). Poprawka naniesiona: trzy pola płaskie
   `zrodloStrona`/`zrodloPlayer`/`zrodloPanel` (liczby przechodzą przez scrub bez zmian);
   `tsc`, lint i testy ponownie zielone; ślad C-54 w `tasks.md`/`verify.md`.

2. **`lib/transkrypcja.ts:245` (`paramsPanelu`) — obserwacja, bez zmiany.** Jednobajtowy varint
   długości ogranicza identyfikator do 127 bajtów — identyfikatory filmów mają stałe 11 znaków
   ASCII, a ograniczenie jest opisane w komentarzu. Świadomy minimalizm (C-53), nie defekt.

3. **`lib/transkrypcja.ts:333` (droga `panel`) — obserwacja, bez zmiany.** Transkrypcja z panelu
   nie zna języka (`jezyk: ""`), więc `transkrypcjaJezyk` będzie pustym stringiem zamiast kodu.
   Kolumna jest opcjonalna, żaden konsument nie gałęziuje po języku (grep), a droga 3 jest
   rezerwą — akceptowalne; odnotowane w komentarzu przy wywołaniu.

Poza tym: guardy/własność bez zmian (job per przestrzeń właściciela jak dotąd), zero enumów,
zero nowych zależności, zero literałów UI, sygnatura `PobierzTresc` wstecznie zgodna (jedyny
produkcyjny konsument to job), migracja 0289 idempotentna w skutkach i przetestowana na danych,
komentarze i log po polsku. Bezpieczeństwo: brak kluczy/logowania sekretów; żądania POST idą
wyłącznie na `youtube.com` ze stałymi ciałami zbudowanymi z `videoId`.

## Werdykt

**APPROVE Z UWAGAMI.** Uwaga nr 1 naprawiona w ramach recenzji; nr 2–3 to świadome, opisane
ograniczenia. Po merge do `develop`: uruchomić „Odśwież" w `/youtube` na środowisku testowym
i odczytać `youtube.transkrypcje.skutecznosc` (rozbicie `zrodlo*`) — to domyka AC-1 na żywych
filmach (sandbox nie ma sieci do YouTube).

---

## Nawrót v2 (2026-09-04)

Wdrożenie v1 nie przyniosło transkrypcji na produkcji (zgłoszenie właściciela). Research wskazał
blokadę IP centrów danych (ASN chmur) i za ubogi ręczny protobuf `params`. v2 (plan §Nawrót v2):
prawdziwe `params` z `getTranscriptEndpoint` (HTML strony → `next` → ręczna budowa wg pełnego
przepisu Invidiousa), przeglądarkowy UA + `SOCS=CAI`, log diagnozy per droga
(`youtube.transkrypcje.diagnoza`, ≤3 filmy/przebieg), migracja 0292 (rekwalifikacja po v1).
Recenzja diffa v2: funkcje czyste z testami dekodującymi protobuf pole po polu (22/22), sygnatury
wstecznie zgodne, nic nie rzuca, bez nowych zależności; pełny build zielony na lokalnym Postgresie.
**Werdykt: APPROVE Z UWAGAMI** — rozstrzygnięcie skuteczności wyłącznie na produkcji (log
skutecznosc/diagnoza po „Odśwież"); jeśli diagnoza pokaże blokadę IP na wszystkich drogach,
dalszy krok (proxy rezydenckie / hostowany API transkrypcji) jest decyzją właściciela.
