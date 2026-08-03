# Warstwa operacyjna — skala, koszt, niezawodność

> Odpowiada na zagrożenia P0 z rozdziału 5 (poza 5.1, które należy do współdzielenia).

## 1. Koniec odpytywania — wypychanie zmian

**Zastępuje:** `setInterval` co 45 s z każdej otwartej karty (diagnoza 5.2).

### 1.1. Łańcuch

```
mutacja → DomainEvent (ta sama transakcja)
        → worker czyta outbox
        → LISTEN/NOTIFY albo Redis Pub/Sub
        → trasa SSE /api/events (jedno połączenie na kartę)
        → klient: router.refresh() TYLKO gdy dotyczy tego, co widzi
```

### 1.2. Kanały — po co, skoro jest jeden strumień

Klient subskrybuje **przestrzenie**, do których należy, oraz **zasoby**, które ma otwarte.
To jest wymóg wynikający ze współdzielenia: użytkownik ma dostać powiadomienie o zmianie
w **cudzym** zasobie, który mu udostępniono — a nie o wszystkim, co dzieje się w jego przestrzeni.

| Kanał | Kto dostaje | Przykład |
|-------|-------------|----------|
| `ws:<workspaceId>` | członkowie przestrzeni | nowe zadanie w projekcie zespołu |
| `res:<type>:<id>` | osoby z nadaniem na zasobie | odhaczenie pozycji na udostępnionej liście |
| `user:<userId>` | jeden użytkownik | powiadomienie, nadanie dostępu, odebranie dostępu |

### 1.3. Odebranie dostępu działa natychmiast

Zdarzenie `sharing.grant.revoked` na kanale `user:<userId>` czyści cache dostępu i wymusza
przeładowanie. **Bez tego użytkownik, któremu odebrano dostęp, widziałby zasób do końca sesji** —
to byłaby dziura bezpieczeństwa wprowadzona przez cache.

### 1.4. `DataFreshness` po zmianie

- **usunięty** `setInterval` co 45 s;
- **zostaje** odświeżenie na `visibilitychange` / `focus` / `pageshow` — tanie, tylko przy powrocie,
  i ratuje sytuację po zerwanym strumieniu;
- **degradacja:** brak SSE (stary klient, proxy, uśpione środowisko testowe) → powrót do odpytywania,
  ale z interwałem **5 minut, nie 45 sekund**.

### 1.5. Ryzyko do zaplanowania

**Środowisko testowe na darmowym planie Rendera zasypia po 15 minutach** — trwałe połączenia będą
się tam rwać. **Będzie wyglądało na zepsute na `develop`, a działać na produkcji.** Zaplanuj to
i opisz w `docs/devops/`, inaczej stracisz dzień na diagnozowanie awarii, której nie ma.

## 2. Współdzielony rate-limit

**Zastępuje:** `Map` w pamięci procesu (diagnoza 5.3).

- Przenieś `src/lib/ai/rateLimit.ts` na **Redis** albo tabelę z atomowym `INSERT … ON CONFLICT DO UPDATE`.
- **Zachowaj ten sam interfejs** — zmienia się implementacja, nie miejsca wywołań.
- Rozszerz poza AI: rejestracja, zaproszenia, **nadania dostępu** (ochrona przed masowym
  udostępnianiem), wysyłka e-maili.
- Test integracyjny z **dwoma procesami**, inaczej regres wróci niezauważony.

## 3. Budżety kosztu AI

**Zastępuje:** liczenie kosztu bez jego ograniczania (diagnoza 5.4).

| Mechanizm | Zachowanie |
|-----------|------------|
| Limit miesięczny per użytkownik | Przekroczenie → uprzejmy komunikat, nie błąd 500 |
| Limit globalny | Wyłącznik awaryjny w `Config`, widoczny w `/admin/llm` |
| Alarm progowy | Powiadomienie admina przy 50 % / 80 % budżetu miesięcznego |
| Widoczność dla użytkownika | „Wykorzystano X z Y" w ustawieniach asystenta |

**Priorytet równy zagrożeniom technicznym** — to jedyne z nich, które kosztuje realne pieniądze,
zanim zdąży zepsuć aplikację.

## 4. Baza danych

| Zmiana | Szczegół |
|--------|----------|
| Pula połączeń | `connection_limit` w `DATABASE_URL`, pgbouncer w trybie transakcyjnym |
| Audyt N+1 | Kalendarz, pulpit, `ModuleSnapshotGrid`, listy z nadaniami dostępu |
| Indeksy pod nowe zapytania | `ResourceGrant` (3 indeksy z rozdz. 8.3), `workspaceId` na wszystkich modelach |
| Paginacja kursorowa | Wszystkie widoki listowe (`cursor` + `take` + „doładuj") |

**Uwaga o indeksach po `workspaceId`:** to zastępuje dzisiejsze indeksy po `ownerId`. Migracja musi
je dodać **przed** przełączeniem zapytań, inaczej pierwsze wdrożenie oznacza pełne skany 46 tabel.

## 5. Cache

Możliwy dopiero po zdarzeniach (punkt 1) — bez nich nie ma czym unieważniać.

| Co | Klucz | Unieważnia |
|----|-------|-----------|
| Agregaty pulpitu | `user:<id>:dashboard` | dowolne zdarzenie z przestrzeni użytkownika |
| Kalendarz | `ws:<id>:calendar:<miesiąc>` | zdarzenia modułów wnoszących wpisy |
| Rozstrzygnięcie dostępu | `access:<userId>:<resourceType>:<resourceId>` | `sharing.grant.*` |
| Lista przestrzeni użytkownika | `user:<id>:workspaces` | `workspace.member.*` |

**Cache dostępu jest najważniejszy i najbardziej ryzykowny** — patrz 11.1.3.

## 6. Retencja

**Zastępuje:** brak retencji poza `cleanupOldJobs` (diagnoza 5.9).

| Tabela | Retencja | Uzasadnienie |
|--------|----------|--------------|
| `UserActivity` | 90 dni | czytane tylko „ostatnie 10" |
| `AiMessage` / `AiConversation` | 12 mies. albo na żądanie użytkownika | dane osobowe, RODO |
| `NewsArticle` | 30 dni | już częściowo istnieje |
| `ItemHistory` | 12 mies. | podpowiedzi zakupowe |
| `DomainEvent` | 30 dni po dostarczeniu | to tylko komunikaty |
| `AiCall` | 12 mies. (agregaty dłużej) | rozliczenia |
| `AuditLog` | **5 lat** | ślad audytowy, w tym nadania dostępu |

Retencja konfigurowalna w `/admin/config`, wykonywana zadaniem okresowym.

## 7. Obserwowalność

**Zastępuje:** brak metryk i logów strukturalnych (diagnoza 5.7).

**Logi strukturalne** (JSON): `requestId`, `userId`, `workspaceId`, `module`, `action`, `durationMs`,
`outcome`. **Bez PII w treści.**

**Metryki na `/admin/health`:**

| Metryka | Po co |
|---------|-------|
| Czas akcji, percentyl 95, per moduł | „co zwolniło" |
| Błędy per moduł | gdzie się psuje |
| Głębokość kolejki i wiek najstarszego zadania | czy worker nadąża |
| Zdarzenia niedostarczone | czy outbox nie zalega |
| Aktywne strumienie SSE | ile trwałych połączeń |
| Koszt AI per doba i per użytkownik | kontrola budżetu |
| **Konflikty edycji per moduł** | czy współdzielenie działa, czy irytuje |

Ostatnia metryka jest nowa i wynika z korekty o współdzieleniu: **rosnąca liczba konfliktów w jednym
module to sygnał, że akurat tam potrzebne jest współredagowanie** (rozdz. 8.6). Bez tej metryki
decyzja o CRDT byłaby zgadywaniem.

## 8. Rozdzielenie procesów

| Proces | Rola | Skalowanie |
|--------|------|------------|
| `web` | obsługa żądań, SSE | poziome, bezstanowe |
| `worker` | zadania w tle, publikacja outboxu | 1–2 instancje |
| `cron` | retencja, przypomnienia, kursy walut | 1 instancja |

Tanie, bo kolejka **już to udźwignie** (`SKIP LOCKED`). Korzyść realna: ciężkie zadania AI przestają
konkurować o CPU z obsługą żądań użytkownika.

## 9. Kolejność i zależności

```
zdarzenia (1) ──┬──> cache (5)
                └──> obserwowalność strumieni (7)
rate-limit (2) ──── niezależne
budżety AI (3) ──── niezależne
baza (4) ─────────── przed wzrostem ruchu
retencja (6) ─────── niezależne
procesy (8) ──────── po (1), bo SSE wymaga sesji lepkich albo współdzielonego pub/sub
```

**Pułapka do zapamiętania:** przy wielu instancjach `web` klient trzyma SSE na **jednej** z nich.
Zdarzenie opublikowane przez inną instancję musi do niej dotrzeć — dlatego pub/sub, a nie
powiadamianie w pamięci procesu. Pominięcie tego daje objaw „u niektórych użytkowników nie działa
odświeżanie", trudny do zdiagnozowania bez metryk.
