# Recenzja: 072 — kanał czasu rzeczywistego

- **Data:** 2026-08-15 · **Diff:** kanał + konsument + bramka + docs

## Ustalenia

### 1. Build padł mimo zielonych sprawdzeń · correctness · **NAPRAWIONE W IMPLEMENTACJI**
Opisane w `verify.md` §5. Warte powtórzenia, bo dotyczy **każdej** przyszłej zmiany:
`check:test-types` używa `tsconfig.test.json` (`target: ES2022`), a `next build` — głównego
`tsconfig.json`, który `target` nie ustawia w ogóle. Iteracja po `Set` przechodzi w jednym,
pada w drugim.

Do tego pomyłka moja, nie kodu: pierwszy wynik builda czytałem przez `tail -3`, a Next wypisuje
tabelę tras także po porażce. **Wygląd końcówki logu nie jest wynikiem — wynikiem jest kod wyjścia.**

### 2. Kanał `user:<userId>` jest zadeklarowany, ale nikt na niego nie nadaje · simplification · **ŚWIADOME**
`kanalyDla` zapisuje kartę na `user:<id>` i `ws:<id>`, ale `dispatch` rozgłasza **wyłącznie** na
`ws:`. Kanał użytkownika jest więc dziś pusty.

**Nie usuwam go** i to jest decyzja, nie przeoczenie: kanał użytkownika ma konkretnego, nazwanego
odbiorcę w rozdz. 11.1.3 — `sharing.grant.revoked`, czyli natychmiastowe odebranie dostępu.
Wejdzie przy zadaniu 25, gdy odebranie zacznie emitować zdarzenie. Subskrypcja karty na ten kanał
kosztuje jeden wpis w mapie, a jej brak wymagałby później zmiany trasy **i** klienta.

Odnotowane, żeby nie wyglądało na zapomniany kod.

### 3. Ładunek sygnału nie może wynieść treści · security · **CZYSTO**
`SygnalKanalu` to dokładnie `{ type, workspaceId }` — sprawdzone w typie i w trasie. Klient
**odświeża się**, a nie renderuje z ładunku; dane zawsze pobiera z serwera przez `router.refresh()`,
czyli przez zwykłą ścieżkę z pełną kontrolą dostępu. Nawet gdyby sygnał trafił nie tam, gdzie
trzeba, nie niesie treści cudzego zasobu.

### 4. Kanały liczone z sesji · security (C-21) · **CZYSTO I PILNOWANE**
Trasa nie dotyka żądania poza sesją; bramka wywala build przy `searchParams`/`req.url`. Sonda
potwierdza, że reguła działa.

### 5. Sprzątanie po zamkniętej karcie · correctness · **CZYSTO**
`cancel()` zatrzymuje puls i odsubskrybowuje; test „odsubskrybowanie realnie usuwa słuchacza"
pilnuje drugiej połowy. Mutacja „odsubskrybowanie nic nie robi" czerwieni.

### 6. Trwała awaria nie zapętla klienta · correctness · **CZYSTO**
`EventSource` sam wznawia w nieskończoność, więc przy 401 albo braku trasy zapętliłby się. Klient
liczy próby i po piątej milknie — zostaje odpytywanie co 5 minut.

## Werdykt

**APPROVE Z UWAGAMI.**

Łańcuch z rozdz. 11.1.1 jest kompletny od mutacji do przeglądarki. Build **EXIT=0**, `test:unit`
**896/896**, `next lint` **0 błędów**, 22 bramki zielone, zapadki bez ruchu.

**Uwagi przeniesione dalej:**
1. Kanał `user:` czeka na `sharing.grant.revoked` (zadanie 25).
2. Kanał **per zasób** (`res:`) — przy pierwszym konsumencie rozróżniającym zasoby (rozdz. 8.8).
3. Szyna w jednym procesie — podmiana na `LISTEN/NOTIFY` przy drugiej instancji; miejsce wskazane
   w `bus.ts` i w `docs/devops/`.
