# Plan techniczny: Publikacja zdarzeń domenowych

- **Spec:** ./spec.md (071-publikacja-zdarzen)
- **Status:** draft
- **Data:** 2026-08-15

## 1. Podejście

Worker zdarzeń jako **bliźniak istniejącego workera kolejki zadań**. To nie jest analogia
z wygody — `src/platform/jobs/{queue,worker}.ts` rozwiązuje **dokładnie te same** cztery problemy:
pobranie bezpieczne wieloworkerowo (`SELECT … FOR UPDATE SKIP LOCKED`), ponowienie po błędzie,
odzysk po awarii i wstrzyknięty (nie zaimportowany) rezolwer wkładu modułowego. Naśladujemy go
co do kształtu (C-53), zamiast wymyślać drugi wzorzec obok.

## 2. Model danych

**Bez zmian w schemacie i bez migracji.** `DomainEvent` z 070 ma wszystko, czego trzeba:
`deliveredAt` (null = do dostarczenia), indeks `[deliveredAt, createdAt]` (dokładnie pod zapytanie
workera) i `id` jako stabilny klucz idempotencji.

**Idempotencja pierwszego subskrybenta też nie wymaga migracji** — `Notification` ma już
`@@unique([userId, dedupeKey])`, czyli wzorzec, który rozdz. 9.4.4 podaje jako zalecany („klucz
idempotencji na tworzonej encji"). `notifyUser` **upsertuje** po tym kluczu.

## 3. Worker zdarzeń — `src/platform/events/`

### 3.1. `queue.ts` — pobranie bezpieczne wieloworkerowo (AC-4)

**Kiedy oznaczyć zdarzenie jako dostarczone — to jest właściwa decyzja tego pliku.** Nie da się
uczynić atomowymi „wykonaj subskrybenta" i „oznacz dostarczone": subskrybent pisze do bazy własną
transakcją. Trzeba więc wybrać, po której stronie leży okno awarii:

| Kiedy oznaczamy | Awaria między jednym a drugim daje | Ocena |
|-----------------|-----------------------------------|-------|
| przy pobraniu | zdarzenie **pominięte** — reakcja nigdy nie nastąpi | ❌ gubi zdarzenia po cichu |
| **po sukcesie** | zdarzenie **ponowione** — reakcja wykona się dwa razy | ✅ „co najmniej raz" |

Rozdz. 9.4.4 wybiera **„co najmniej raz"** świadomie, a ceną jest wymóg idempotencji subskrybenta —
który egzekwujemy bramką (§5). Oznaczamy więc **po sukcesie**.

**Rezerwacja bez dodatkowej kolumny:** obieg otwiera transakcję, pobiera partię przez
`SELECT … WHERE "deliveredAt" IS NULL ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT n`,
wywołuje subskrybentów i na końcu ustawia `deliveredAt`. Blokada wiersza trzyma się do końca
transakcji, więc drugi worker tych wierszy **nie zobaczy** — bez kolumny „w trakcie" i bez
visibility timeout. Partia jest ograniczona `LIMIT`, żeby transakcja nie trwała długo.

### 3.2. `dispatch.ts` — wywołanie subskrybentów

Rezolwer **wstrzykiwany**, jak w workerze kolejki (049):

```ts
export type SubscriberResolver = (type: DomainEventType) => Promise<EventSubscriber[]>;
export function setEventSubscriberResolver(resolver: SubscriberResolver): void;
```

Platforma **nie importuje** korzenia kompozycji — parametr jest wymagany, bez wartości domyślnej
(wartość domyślna „na razie" to dokładnie ciche obejście, którego C-36 zabrania).

**Izolacja błędu (AC-3):** subskrybenci jednego zdarzenia lecą **osobno**; wyjątek jednego nie
przerywa pozostałych, ale **całe zdarzenie zostaje niedostarczone** i wróci. To znaczy, że pozostali
subskrybenci dostaną je ponownie — czyli znów: idempotencja nie jest opcją.

**Zdarzenie bez subskrybentów (AC-9)** jest oznaczane jako dostarczone od razu. Zdarzenie, na które
nikt nie czeka, nie może zatykać obiegu ani wracać w nieskończoność.

### 3.3. `worker.ts` — obieg

Tick co kilka sekund, jak worker kolejki, startowany z `instrumentation.ts`. **Bez `LISTEN/NOTIFY`**
— uzasadnienie w specu §5: wymaga surowego połączenia poza Prismą (nowa zależność), a kupuje
wyłącznie niższe opóźnienie, które zaczyna mieć znaczenie dopiero przy kanale czasu rzeczywistego
(zadanie 23). Tam ta decyzja ma realny wymóg; tutaj byłaby zależnością na zapas.

## 4. Protokół subskrypcji — deklaracja modułu (AC-5)

**SPROSTOWANIE PO PRZECZYTANIU KODU (C-54).** Plan zakładał nowe pole w
`ModuleServerContributions`. To byłoby powtórzenie błędu, który 050 już zmierzyło i opisało w tym
samym pliku: **wspólny rejestr leniwych loaderów jest plikiem zbiorczym**. Kto importuje go dla
jednego pola, dostaje do grafu cele `import()` **wszystkich** pozostałych — wkłady pulpitu wpięte
tą drogą podniosły graf strony głównej z 1889 do 2117 modułów, i dlatego dostały własny korzeń.

Subskrypcje idą więc **wzorcem pulpitu (050)**, nie wzorcem `ai`/`jobs`/`calendar`:

```
src/modules/<x>/events.ts     → { subscribers: EventSubscriber[] }   (domyślny eksport)
src/lib/eventSubscribers.ts   → własny korzeń kompozycji, leniwe loadery per moduł
```

Cena jest tu wręcz niższa niż przy pulpicie: korzeń importuje **wyłącznie** worker zdarzeń, czyli
kod serwerowy, którego klient nie dotyka.

Subskrybent deklaruje, **na co** reaguje i **co robi**:

```ts
interface EventSubscriber {
  id: string;                    // stabilny, do manifestu i logów
  on: DomainEventType[];
  handle(event: DomainEventRecord): Promise<void>;
}
```

Korzeń kompozycji: `src/lib/eventSubscribers.ts`, obok `calendarContributors.ts` i `jobs/registry.ts`.

## 5. Wymuszona idempotencja (AC-6) — `scripts/check-subscribers.js`

**Zdanie „subskrybent musi być idempotentny" w dokumentacji jest życzeniem.** Bramka żąda decyzji,
tak jak reszta manifestów w repo (`events-coverage.json`, `domain-coverage.json`).

Manifest `src/lib/subscribers-coverage.json`: każdy subskrybent ma `idempotencja` — **jak** jest
zapewniona — z zamkniętej listy:

| Wartość | Znaczenie | Co sprawdza bramka |
|---------|-----------|--------------------|
| `klucz-unikalny` | zapis przez `upsert` na kluczu wyprowadzonym z **id zdarzenia** | plik zawiera `upsert` **i** `event.id` |
| `naturalna` | operacja jest z natury bezpieczna przy powtórzeniu (ustawienie wartości, nie inkrementacja) | wymaga `powod` ≥ 40 znaków |

Cztery kontrole: (1) każdy subskrybent ma wpis; (2) wpis bez subskrybenta = błąd; (3) `idempotencja`
z listy; (4) `klucz-unikalny` wymaga `upsert` + `event.id` w pliku. Test negatywny **osobno dla każdej**.

**Świadome ograniczenie:** bramka sprawdza **obecność wzorca**, nie dowodzi idempotencji. Dowodem
jest test podwójnego dostarczenia (AC-2), który mierzy **skutek**. Bramka pilnuje, żeby nikt nie
dodał subskrybenta **bez podjęcia tej decyzji** — i to jest jej cała rola.

## 6. Pierwszy subskrybent (C-35)

**`shopping.list.completed` → powiadomienie dla POZOSTAŁYCH członków przestrzeni.**

Dlaczego akurat ten:
- **To jest przykład wprost z rozdz. 9.4.1**: `actorId` jest w modelu po to, żeby dało się
  powiedzieć „Marek ukończył zadanie". Ten subskrybent jest pierwszym użyciem tego pola.
- **Nie zabiera zakresu zadania 25.** Tamto to `Zakupy→Portfel` i `Magazyn→Zakupy`; tu odbiorcą
  jest **zdolność platformy** (powiadomienia), nie inny moduł.
- **Idempotencja bez nowego kodu**: `notifyUser` upsertuje po `dedupeKey`, a klucz bierzemy
  z **id zdarzenia** (`zdarzenie-<id>`), więc stabilny między ponowieniami. Wpis w manifeście:
  `klucz-unikalny`.
- **Dla właściciela zmiana jest zerowa.** Powiadomienie idzie do **innych** członków przestrzeni;
  w przestrzeni osobistej nie ma nikogo innego, więc solo-użytkownik nie zobaczy nic. Zmiana
  ujawnia się dopiero przy zespole — i to dokładnie ta, o którą chodzi w rozdz. 9.4.1.

Umiejscowienie: **Zakupy** (`src/modules/shopping/events.ts`), bo to moduł źródłowy i on wie, jak
nazwać rzecz po polsku. Powiadomienia są zdolnością platformy, więc `notifyUser` woła się przez
istniejący `@/lib/notify` — bez sięgania do cudzego modułu.

## 7. Pliki

| Plik | Akcja |
|------|-------|
| `src/platform/events/types.ts` | edycja — `EventSubscriber`, `DomainEventRecord` |
| `src/platform/events/queue.ts` · `dispatch.ts` · `worker.ts` | nowe |
| `src/platform/events/__tests__/dispatch.integration.test.ts` | nowy |
| `src/platform/events/subscriber.ts` | nowy — typ wkładu (bez zmian w `registry.server.ts`) |
| `src/modules/shopping/{events.ts,module.server.ts}` | subskrybent + deklaracja |
| `src/lib/eventSubscribers.ts` | korzeń kompozycji |
| `src/lib/subscribers-coverage.json` · `scripts/check-subscribers.js` · `package.json` | manifest + bramka |
| `src/instrumentation.ts` | start workera |
| `content/architektura/15-dziennik.md` · `doświadczenia.md` | domknięcie |

**Bez migracji. Bez zmian w `src/app/**` i `src/components/**`.**

## 8. Bramki i weryfikacja (C-50)

Lokalny Postgres (C-13). Mapowanie: AC-1/2/3/9 → testy integracyjne · AC-4 → test dwóch równoległych
obiegów · AC-5 → subskrybent z deklaracji + brak importu modułu w platformie · AC-6/AC-7 → bramka
+ sondy · AC-8 → przebieg mutacyjny · AC-10 → liczniki + `git diff --stat`.

## 9. Ryzyka i wycofanie

- **Długa transakcja obiegu** blokuje wiersze → partie ograniczone `LIMIT`, subskrybenci mają być
  krótcy; odnotowane jako obserwacja dla zadania 28 (wydajność).
- **Subskrybent zapisujący poza swoją transakcją** → nie wymuszamy tego typem (inaczej niż w 070),
  bo subskrybent bywa złożony; ryzyko przyjęte i zapisane.
- **Worker startuje dwa razy** (HMR w dev) → ten sam guard singletona co w workerze kolejki.
- **Rollback:** czysto kodowy, brak migracji. Wyłączenie startu workera zatrzymuje dostarczanie,
  a zdarzenia czekają w dzienniku — dokładnie po to `deliveredAt` istnieje.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — brak zmian w schemacie, brak migracji.
- [x] C-20/C-21 — subskrybent działa bez sesji; dostęp wynika z przestrzeni w zdarzeniu.
- [x] C-35 — mechanizm z prawdziwym subskrybentem.
- [x] C-36 — rezolwer subskrybentów **wstrzykiwany**, deklaracja po stronie serwerowej.
- [x] C-50/C-51 — bramka w buildzie, lekcje.
- [x] C-53 — **zero nowych zależności**; `LISTEN/NOTIFY` świadomie odłożone do zadania 23.
