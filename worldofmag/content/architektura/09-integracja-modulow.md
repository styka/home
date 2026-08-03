# Integracja międzymodułowa — sedno produktu

> Dotyczy tego, co czyni Omnię Omnią: **każdy moduł umie współpracować z każdym**. Jeśli przebudowa
> to zepsuje, będzie porażką niezależnie od tego, jak ładna wyjdzie struktura katalogów.

## 1. Trzy rodzaje integracji, trzy mechanizmy

Dziś wszystkie trzy realizowane są tak samo — bezpośrednim wywołaniem. To błąd, bo mają **różne
wymagania co do spójności, kierunku zależności i obsługi awarii**.

| Rodzaj | Pytanie | Przykłady | Mechanizm | Spójność |
|--------|---------|-----------|-----------|----------|
| **Odczyt** | „pokaż mi dane innego modułu" | Kalendarz agreguje 6 modułów; asystent czyta wszystkie; pulpit | **Kontrakt** — wywołanie synchroniczne | natychmiastowa |
| **Reakcja** | „gdy tam coś się stanie, zrób coś tutaj" | zakupy → Portfel; niski stan magazynu → Zakupy; pomysł Pogody → Zadania | **Zdarzenie** (outbox) | ostateczna (sekundy) |
| **Zdolność** | „potrafię coś, z czego korzystają wszyscy" | współdzielenie, kosz, powiadomienia, AI, kalendarz, aktywność | **Usługa platformy** | natychmiastowa |

**Reguła rozstrzygająca:**

> Brak odpowiedzi **zatrzymuje** operację → kontrakt.
> Brak odpowiedzi ją tylko **opóźnia** → zdarzenie.
> Robi to więcej niż trzy moduły → usługa platformy.

## 2. Kontrakt modułu

### 2.1. Kształt

```ts
// src/modules/tasks/contract.ts
// JEDYNY plik tego modułu widoczny dla innych modułów.

/** Wąski typ własny — NIGDY modelu Prismy. */
export interface TaskSummary {
  id: string;
  title: string;
  dueAt: Date | null;
  done: boolean;
  projectName: string | null;
}

/** Odczyt: zadania z terminem w zakresie. Używa Kalendarz i pulpit. */
export function tasksInRange(ctx: AccessCtx, from: Date, to: Date): Promise<TaskSummary[]>;

/** Zapis inicjowany przez inny moduł (np. „dodaj pomysł Pogody do zadań"). */
export function createTaskFromModule(ctx: AccessCtx, input: {
  title: string;
  source: { module: string; id: string };   // ślad pochodzenia — do odlinkowania
}): Promise<{ id: string }>;

/** Zdarzenia publikowane przez ten moduł — kontrakt dla nasłuchujących. */
export type TaskEvent =
  | { type: "task.completed"; taskId: string; workspaceId: string }
  | { type: "task.overdue";   taskId: string; workspaceId: string };
```

### 2.2. Cztery twarde zasady

1. **Zwraca własne, wąskie typy — nigdy modeli Prismy.** Wypuszczenie modelu sprawia, że dodanie
   kolumny w jednym module psuje trzy inne. To dokładnie to, przed czym granica ma chronić.
2. **Jest minimalny.** Zaczynamy od odwrócenia istniejących importów: **co dziś importuje Kalendarz
   z Zadań, to jest kontrakt Zadań** — nic więcej. Kontrakt „na wszelki wypadek" to granica, która
   nic nie ogranicza.
3. **Przyjmuje kontekst dostępu jawnie** (`AccessCtx`: użytkownik + jego przestrzenie), nie czyta
   sesji. Dzięki temu da się go wywołać z zadania w tle, z asystenta AI i z testu.
4. **Sam egzekwuje dostęp.** Kontrakt nie ufa wołającemu — wywołuje `requireAccess`. Moduł wołający
   nie może przypadkiem obejść uprawnień drugiego modułu.

### 2.3. Dlaczego to nie jest zbędna warstwa

Naturalne zastrzeżenie: „przecież to re-eksport funkcji, po co?".

**Kontrakt jest miejscem, w którym widać koszt sprzężenia.** Dziś sprzężenie jest rozproszone po
importach w kilkudziesięciu plikach i niewidoczne. Po zmianie każde sprzężenie to jedna linijka
w jednym pliku — **widoczna na przeglądzie kodu**. Kontrakt rosnący do 40 funkcji to sygnał, że
moduł robi za dużo. Dziś nie ma jak tego zauważyć.

## 3. Deklaracja rejestrująca

### 3.1. Kształt

```ts
// src/modules/tasks/module.ts
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "tasks",
  labelKey: "modules.tasks.label",          // klucz i18n
  permission: "module.tasks",               // RBAC modułowy (kto w ogóle widzi moduł)
  routes: ["/tasks"],
  icon: CheckSquare,
  color: "var(--accent-green)",

  /** Typy zasobów tego modułu — źródło współdzielenia (rozdz. 8.4). */
  resources: {
    "tasks.project": {
      labelKey: "modules.tasks.resource.project",
      operations: { "task.create": "editor", "project.rename": "manager" },
      children: ["tasks.task"],
    },
    "tasks.task": { labelKey: "…", operations: { "task.edit": "editor" } },
  },

  /** Kafelek pulpitu — ładowany leniwie. */
  dashboard: () => import("./ui/DashboardCard"),

  /** Wkład do wspólnego kalendarza — zamiast gałęzi w `getCalendarEvents`. */
  calendar: (ctx, range) => tasksInRange(ctx, range.from, range.to),

  /** Wkład do asystenta — zamiast ręcznej listy w katalogu akcji. */
  ai: { actions: taskAiActions, readTools: taskReadTools },

  /** Skróty klawiszowe strony (rejestr z wersji 043). */
  shortcuts: taskShortcuts,

  /** Na co ten moduł reaguje. */
  subscribes: {
    "shopping.list.completed": onShoppingCompleted,
    "weather.idea.accepted":   onWeatherIdeaAccepted,
  },
});
```

### 3.2. Mierzalny efekt

| Czynność | Dziś | Docelowo |
|----------|------|----------|
| Dodanie modułu | 8 miejsc, ryzyko pominięcia | **1 katalog + 1 deklaracja** |
| Dodanie udostępniania do modułu | własna tabela, role, guardy | **kilka linijek w `resources`** |
| Usunięcie modułu | ręczne szukanie po repozytorium | usunięcie katalogu |
| Wyłączenie modułu (flaga) | niemożliwe | `enabled: false` |
| Sprawdzenie, co moduł udostępnia | czytanie kilkudziesięciu plików | `contract.ts` |

**To jest liczba, którą warto pokazać jako wynik przebudowy: 8 → 1.**

## 4. Zdarzenia domenowe

### 4.1. Model

```prisma
model DomainEvent {
  id          String    @id @default(cuid())
  workspaceId String                  // pozwala filtrować strumień per przestrzeń
  module      String
  type        String                  // "shopping.list.completed" (String + unia TS — C-12)
  payload     Json
  actorId     String?                 // KTO wywołał — istotne przy współdzieleniu
  createdAt   DateTime  @default(now())
  deliveredAt DateTime?

  @@index([deliveredAt, createdAt])    // wybieranie niedostarczonych
  @@index([workspaceId, createdAt])    // strumień przestrzeni
}
```

`actorId` jest nowy względem typowego outboxu i wynika wprost z korekty o współdzieleniu: przy
wspólnym zasobie „kto to zrobił" jest pytaniem, które padnie — zarówno w interfejsie („Marek
ukończył zadanie"), jak i w audycie.

### 4.2. Zapis w tej samej transakcji

**Warunek poprawności całego mechanizmu:**

```ts
await prisma.$transaction(async (tx) => {
  await tx.shoppingList.update({ where: { id }, data: { archived: true } });
  await tx.domainEvent.create({ data: {
    workspaceId, module: "shopping", type: "shopping.list.completed",
    actorId: user.id, payload: { listId: id, total },
  }});
});
```

Zapis zdarzenia **poza** transakcją oznacza, że przy awarii między zapisem a publikacją stan
i zdarzenia się rozjadą — i nikt się o tym nie dowie. To najczęstszy błąd przy wdrażaniu outboxu.

### 4.3. Publikacja — bez Kafki

Worker (istnieje, ma `SKIP LOCKED`) czyta niedostarczone zdarzenia i:
1. wywołuje subskrybentów zadeklarowanych w `module.ts`,
2. wypycha do przeglądarek przez kanał czasu rzeczywistego (rozdz. 11.1),
3. oznacza `deliveredAt`.

**Nie dokładamy Kafki ani RabbitMQ.** `LISTEN/NOTIFY` PostgreSQL albo Redis Pub/Sub wystarcza i jest
o rząd wielkości tańsze w utrzymaniu. Kafka staje się sensowna dopiero przy Progu C i zdarzeniach
liczonych w setkach tysięcy na sekundę.

### 4.4. Gwarancje i ich świadome ograniczenia

| Gwarancja | Stan | Konsekwencja |
|-----------|------|--------------|
| Zdarzenie nie zginie | ✅ transakcja + `deliveredAt` | — |
| Dostarczenie **co najmniej raz** | ✅ ponowienia workera | **subskrybent musi być idempotentny** |
| Dokładnie raz | ❌ świadomie nie | koszt nieproporcjonalny do zysku |
| Kolejność globalna | ❌ świadomie nie | kolejność **per `workspaceId`** wystarcza |

**Zasada dla implementującego:** każdy subskrybent musi wytrzymać dwukrotne wywołanie tym samym
zdarzeniem. Najprościej — klucz idempotencji na tworzonej encji (`@@unique([sourceModule, sourceId])`,
wzorzec już obecny w `WalletEntry`).

## 5. Migracja istniejących integracji

Kolejność: od najprostszych, żeby wzorzec się utrwalił przed trudnymi.

| Integracja dziś | Docelowo | Trudność |
|-----------------|----------|----------|
| `activity` importowane przez 17 modułów | usługa platformy `platform/activity` | 🟢 to nigdy nie był moduł |
| Pogoda → Zadania (pomysł do zadań) | `createTaskFromModule` w kontrakcie | 🟢 |
| Kalendarz agreguje 6 modułów | `calendar` w `defineModule` każdego z nich | 🟡 usuwa gałęzie z `getCalendarEvents` |
| Zakupy → Portfel (auto-wydatek) | zdarzenie `shopping.list.completed` | 🟡 pierwszy prawdziwy subskrybent |
| Magazyn → Zakupy (uzupełnienie zapasów) | zdarzenie `storage.item.belowMinimum` | 🟡 |
| Nawyki ↔ Zadania | kontrakty obustronne | 🟡 |
| **Asystent AI → wszystkie moduły** | katalog składany z `module.ts` | 🔴 **OSTATNIE** |

## 6. Asystent AI — najsilniej sprzężony element

Asystent zna **wszystkie** akcje (160), **wszystkie** odczyty i **wszystkie** moduły. Jest
jednocześnie największą wartością produktu i największym punktem sprzężenia.

**Po Fazie 1 jego katalog jest składany z deklaracji modułów**, a nie utrzymywany ręcznie:

```ts
// platform/ai/catalog.ts
export function buildAiCatalog(modules: ModuleDef[]) {
  return {
    actions:   modules.flatMap((m) => m.ai?.actions ?? []),
    readTools: modules.flatMap((m) => m.ai?.readTools ?? []),
  };
}
```

**Bramki zostają — zmienia się to, czego pilnują.** Dziś: czy ręczna lista jest kompletna. Docelowo:
czy każdy moduł zadeklarował swoje akcje i czy każda ma egzekutor oraz kontrakt. To **mocniejsza**
gwarancja — nie da się zapomnieć o module, bo moduł bez deklaracji nie istnieje dla aplikacji.

**Dodatkowe wymaganie po korekcie o współdzieleniu:** read-toole asystenta muszą przechodzić przez
`requireAccess`, a nie przez `where: { ownerId }`. Inaczej asystent stanie się drogą obejścia
uprawnień do zasobów współdzielonych — **to jest realne zagrożenie bezpieczeństwa** i musi być
pokryte testem.

**Kolejność:** migruj asystenta **jako ostatni**, gdy wszystkie 21 modułów ma `module.ts`.

## 7. Ryzyka i ograniczenia

| Ryzyko | Ograniczenie |
|--------|--------------|
| Kontrakty rozrosną się do „wszystko publiczne" | Przegląd rozmiaru przy każdym `/review`; >15 funkcji = sygnał alarmowy |
| Zdarzenia zastąpią wywołania tam, gdzie potrzebna natychmiastowość | Reguła rozstrzygająca z 9.1 |
| Subskrybent nieidempotentny zdubluje dane | Klucz idempotencji obowiązkowy + test podwójnego dostarczenia |
| Migracja asystenta wywróci 160 akcji | Robiona ostatnia, po ustabilizowaniu `module.ts`; bramki chronią |
| Asystent obejdzie uprawnienia do zasobu współdzielonego | Read-toole przez `requireAccess` + test kontraktowy |
