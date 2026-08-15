# Zadania: Publikacja zdarzeń domenowych

- **Plan:** ./plan.md (071-publikacja-zdarzen)
- **Status:** todo
- **Data:** 2026-08-15

> Kolejność: **protokół → pobranie → rozsyłka → subskrybent → worker → bramka → dowody**.
> Bramka nie ma czego liczyć przed subskrybentem; subskrybent nie ma się czym zadeklarować przed
> protokołem.

## Legenda
`[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[P]` równolegle

## Faza 0 — Punkt odniesienia
- [ ] **T-1** — Stan wyjściowy: **884** testy, liczniki 160/553/35/35, zapadki 263 i 34, 20 bramek.

## Faza 1 — Protokół
- [ ] **T-2** — `platform/events/types.ts`: `DomainEventRecord`, `EventSubscriber`
  (`id`, `on`, `handle`). Bez importu modułu.
- [ ] **T-3** — Typ wkładu w `platform/events/subscriber.ts` + **własny korzeń kompozycji**
  `src/lib/eventSubscribers.ts` (wzorzec pulpitu z 050, **nie** pole w `ModuleServerContributions` —
  tamten obiekt jest plikiem zbiorczym: import dla jednego pola wciąga cele `import()` wszystkich).

## Faza 2 — Mechanizm
- [ ] **T-4** — `platform/events/queue.ts`: pobranie partii `FOR UPDATE SKIP LOCKED` w transakcji,
  oznaczenie `deliveredAt` **po sukcesie** (plan §3.1 — „co najmniej raz", rozdz. 9.4.4).
- [ ] **T-5** — `platform/events/dispatch.ts`: rezolwer **wstrzykiwany** (C-36), izolacja błędu
  subskrybenta, zdarzenie bez subskrybentów → dostarczone od razu (AC-9).
- [ ] **T-6** — `platform/events/worker.ts`: obieg + guard singletona; wpięcie w `instrumentation.ts`.

## Faza 3 — Pierwszy subskrybent (C-35)
- [ ] **T-7** — `src/modules/shopping/events.ts`: `shopping.list.completed` → powiadomienie dla
  **pozostałych** członków przestrzeni; `dedupeKey` z **id zdarzenia**. Deklaracja w
  `module.server.ts`, wpięcie w `src/lib/eventSubscribers.ts`.

## Faza 4 — Testy
- [ ] **T-8** — `dispatch.integration.test.ts`: dostarczenie · **podwójne dostarczenie daje ten sam
  stan** (AC-2, sedno) · subskrybent rzuca → zdarzenie wraca, inne przechodzą · brak subskrybentów →
  dostarczone · **dwa obiegi równolegle nie biorą tego samego zdarzenia** (AC-4).

## Faza 5 — Bramka i manifest
- [ ] **T-9** — `src/lib/subscribers-coverage.json`: `zdarzenia`, `idempotencja`
  (`klucz-unikalny` | `naturalna`), `powod`.
- [ ] **T-10** — `scripts/check-subscribers.js`: cztery kontrole z planu §5. Komunikaty PL.
- [ ] **T-11** — `package.json`: `check:subscribers` + krok w `build`.

## Faza 6 — Dowody
- [ ] **T-12** — **Sondy bramki, każda osobno**: subskrybent bez wpisu · wpis bez subskrybenta ·
  nieznana wartość `idempotencja` · `klucz-unikalny` bez `upsert`/`event.id`.
- [ ] **T-13** — **Przebieg mutacyjny**: `dedupeKey` bez id zdarzenia (traci idempotencję) ·
  `deliveredAt` ustawiany przed subskrybentem · brak izolacji błędu · powiadomienie także dla
  sprawcy · brak `SKIP LOCKED`. *Gotowe, gdy:* **0 niezłapanych**.

## Faza 7 — Domknięcie
- [ ] **T-14** — `npm run build` + `test:unit`; liczniki nie spadły.
- [ ] **T-15** — Dziennik: wpis 071, status zadania 22, co zostaje na 23–25; przebakowanie.
- [ ] **T-16** — `doświadczenia.md` (C-51).

## Mapowanie AC

| AC | Zadania |
|----|---------|
| AC-1, AC-2, AC-3, AC-9 | T-8, T-13 |
| AC-4 | T-4, T-8 |
| AC-5 | T-2, T-3, T-7 |
| AC-6 | T-9, T-10 |
| AC-7 | T-12 |
| AC-8 | T-13 |
| AC-10 | T-1, T-14 |

## Ścieżka krytyczna

`T-1` → `T-2`/`T-3` → `T-4` → `T-5` → `T-6` → `T-7` → `T-8` → `T-9` → `T-10` → `T-11` →
`T-12`/`T-13` → `T-14` → `T-15`/`T-16`.

## Notatki
- Poza zakresem: `LISTEN/NOTIFY` (decyzja przy zadaniu 23, gdzie jest realny wymóg opóźnienia),
  SSE (23), komplet subskrypcji międzymodułowych i usunięcie synchronicznego `bookAutoExpense` (25),
  retencja (30).
