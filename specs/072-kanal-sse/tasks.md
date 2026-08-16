# Zadania: Kanał czasu rzeczywistego (zadania 23 + 24)

- **Plan:** ./plan.md (072-kanal-sse) · **Status:** done · **Data:** 2026-08-15

## Faza 0
- [x] **T-1** — Punkt odniesienia: 889 testów, 21 bramek, zapadki 263/34.

## Faza 1 — Szyna i strumień
- [x] **T-2** — `platform/events/bus.ts`: `subskrybuj` (zwraca odsubskrybowanie) + `rozglos`,
  guard singletona, ograniczenie „jeden proces" nazwane w kodzie.
- [x] **T-3** — `bus.test.ts` bez bazy: trafia do właściwego kanału · **nie do cudzego** ·
  odsubskrybowanie realnie działa · dwóch słuchaczy tego samego kanału.
- [x] **T-4** — `app/api/events/route.ts`: sesja (401 bez niej), kanały **z kontekstu dostępu**,
  puls 25 s, sprzątanie w `cancel()`.
- [x] **T-5** — `dispatch.ts`: rozgłoszenie **po** oznaczeniu dostarczenia.

## Faza 2 — Konsument (zadanie 24)
- [x] **T-6** — `DataFreshness`: `EventSource` zamiast `setInterval` 45 s; awaryjne odpytywanie
  **5 min na stałe**; `visibilitychange`/`focus`/`pageshow` bez zmian; zamknięcie po serii błędów.

## Faza 3 — Bramka i dowody
- [x] **T-7** — `scripts/check-realtime.js`: cztery kontrole z planu §6 + wpięcie w `build`.
- [x] **T-8** — **Sondy, każda osobno**: kanał z żądania · trasa bez `auth()` · interwał < 5 min ·
  `subskrybuj` bez odsubskrybowania.
- [x] **T-9** — Przebieg mutacyjny na szynie: rozgłoszenie do wszystkich kanałów · odsubskrybowanie
  nic nie robi. **0 niezłapanych**.

## Faza 4 — Domknięcie
- [x] **T-10** — `docs/devops/kanal-czasu-rzeczywistego.md` (AC-7): jedna instancja, usypiające
  środowisko testowe, jak rozpoznać „awarię, której nie ma".
- [x] **T-11** — `npm run build` + `test:unit`; liczniki bez spadku.
- [x] **T-12** — Dziennik: wpis 072, statusy zadań **23 i 24**, co zostaje na 25; przebakowanie.
- [x] **T-13** — `doświadczenia.md` (C-51).

## Mapowanie AC
AC-1/AC-2 → T-2,T-3,T-5 · AC-3 → T-4,T-8 · AC-4/AC-5/AC-6 → T-6 · AC-7 → T-10 ·
AC-8 → T-8 · AC-9 → T-1,T-11.
