# Specyfikacja importu zadań (model `Task`) — dla agenta transformującego

Ten dokument opisuje **dokładnie** pola zadań w aplikacji WorldOfMag/Omnia, ich typy,
dozwolone wartości oraz **sposób zapisu cykliczności w bazie**. Jest pomyślany jako
wejście dla innego agenta, który ma przetransformować dane z dowolnego formatu
(np. arkusz kalkulacyjny) do naszego formatu i wygenerować INSERT-y / JSON.

Źródła prawdy w kodzie (gdyby coś było niejasne, czytaj je):
- `prisma/schema.prisma` → modele `Task`, `TaskProject`
- `src/types/index.ts` → typy `Task`, `TaskStatus`, `TaskPriority`, `RecurringRule`, `TaskProject`
- `src/lib/recurrence.ts` → `computeNextDue()` (semantyka cykliczności)
- `src/components/tasks/RecurringBadge.tsx` → jak reguła jest formatowana z powrotem na tekst
- `src/actions/tasks.ts` → zapis/odczyt `recurring` (JSON.stringify), `completeRecurringTask()`

---

## 1. Model `Task` — pola

Definicja w Prisma (`String` zamiast enumów, bo SQLite ich nie wspiera — poprawność
trzymają unie TypeScript):

| Pole | Typ DB (Prisma) | Typ TS | Null? | Default | Uwagi dla importu |
|------|-----------------|--------|-------|---------|-------------------|
| `id` | `String @id @default(cuid())` | `string` | nie | cuid() | W INSERT-cie generuj sam: w PostgreSQL użyj `gen_random_uuid()::text` (kolumna to zwykły tekst, nie musi to być cuid). |
| `title` | `String` | `string` | **nie** | — | Wymagane. Pierwsza/najważniejsza linia zadania. |
| `description` | `String?` | `string \| null` | tak | `null` | Markdown/zwykły tekst. Tu sklejaj dodatkowe kolumny opisu i metadane bez własnego pola. |
| `status` | `String` | `TaskStatus` | nie | `"TODO"` | Patrz §2. Dla importu „do zrobienia" → `"TODO"`. |
| `priority` | `String` | `TaskPriority` | nie | `"NONE"` | Patrz §3. |
| `dueDate` | `DateTime?` | `Date \| null` | tak | `null` | Termin wykonania. ISO 8601 (UTC), np. `2026-05-06T00:00:00.000Z`. |
| `startDate` | `DateTime?` | `Date \| null` | tak | `null` | Zwykle `null` przy imporcie. |
| `completedAt` | `DateTime?` | `Date \| null` | tak | `null` | `null` dopóki nie zrobione. |
| `estimatedMins` | `Int?` | `number \| null` | tak | `null` | Szacowany czas **w minutach** (liczba całkowita). |
| `recurring` | `String?` | `string \| null` | tak | `null` | **JSON-string** z `RecurringRule` (patrz §4). `null` = zadanie jednorazowe. |
| `category` | `String` | `string` | nie | `"Other"` | Dowolny tekst (swobodna kategoria/kontekst). |
| `order` | `Float` | `number` | nie | `0` | Kolejność sortowania (rosnąco). Można użyć indeksu pozycji. |
| `projectId` | `String?` | `string \| null` | tak | `null` | FK → `TaskProject.id`. Dla importu do projektu „LZ" ustaw na id tego projektu. |
| `parentTaskId` | `String?` | `string \| null` | tak | `null` | Pod-zadania. Przy imporcie zwykle `null`. |
| `createdById` | `String?` | `string \| null` | tak | `null` | FK → `User.id`. „Czyje" jest zadanie = id właściciela (admina). |
| `assigneeId` | `String?` | `string \| null` | tak | `null` | FK → `User.id`. Osoba przypisana (opcjonalnie). |
| `createdAt` | `DateTime @default(now())` | `Date` | nie | now() | W INSERT-cie ustaw `CURRENT_TIMESTAMP`. |
| `updatedAt` | `DateTime @updatedAt` | `Date` | nie | (auto) | W surowym INSERT-cie ustaw ręcznie `CURRENT_TIMESTAMP` (brak triggera w DB). |

> **„Zadanie należące do użytkownika"** nie jest polem w `Task`. Własność wynika z
> projektu: `Task.projectId` → `TaskProject.ownerId = <user.id>`. Dodatkowo dla importu
> warto ustawić `Task.createdById = <user.id>` (twórca).

---

## 2. `TaskStatus` (enum-przez-string)

```ts
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_VERIFICATION" | "DONE" | "CANCELLED" | "DEFERRED";
```
- Wartość domyślna i „do zrobienia" → **`"TODO"`**.
- `IN_VERIFICATION` to opcjonalny status „w weryfikacji" (włączany per-projekt), nieistotny przy imporcie.

## 3. `TaskPriority` (enum-przez-string)

```ts
type TaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
```
Pięć poziomów, rosnąco: `NONE < LOW < MEDIUM < HIGH < URGENT`.

> Jeśli źródło ma więcej niż 5 poziomów, zmapuj malejąco od najwyższego i sklej nadmiarowe
> dolne do `LOW`/`NONE`. Sugerowane mapowanie dla skali 6-stopniowej (Blocker→Trivial):
> `Blocker→URGENT`, `Critical→HIGH`, `High→MEDIUM`, `Normal→LOW`, `Low→LOW`, `Trivial→NONE`.

---

## 4. Cykliczność — jak jest zapisywana w bazie (NAJWAŻNIEJSZE)

Cykliczność trzymamy **w jednej kolumnie `Task.recurring`** jako **string z JSON-em**
obiektu `RecurringRule`. `null`/brak = zadanie jednorazowe. Zapis robi
`JSON.stringify(rule)` (`src/actions/tasks.ts`), odczyt `JSON.parse`.

### Interfejs
```ts
interface RecurringRule {
  type: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;        // co ile jednostek (1 = co dzień/tydzień/miesiąc/rok)
  daysOfWeek?: number[];   // 0=niedziela … 6=sobota — TYLKO dla WEEKLY
  dayOfMonth?: number;     // 1–31 — patrz uwaga niżej (obecnie nieużywane przez logikę)
  endDate?: string | null; // ISO; po tej dacie nie generujemy kolejnego wystąpienia
}
```

### Semantyka (z `computeNextDue()` — to jest realne zachowanie)
Następny termin liczony jest od poprzedniego `dueDate`:
- **DAILY**: `dueDate + interval` dni. (`interval:1` = codziennie, `interval:2` = co 2 dni)
- **WEEKLY**:
  - jeśli podano `daysOfWeek` (np. `[1]` = poniedziałek, `[5]` = piątek, `[1,3,5]`),
    skacze do **najbliższego kolejnego dnia z listy** (interval jest wtedy ignorowany);
  - jeśli `daysOfWeek` puste/brak → `dueDate + 7*interval` dni (`interval:2` = co 2 tygodnie).
- **MONTHLY**: `dueDate + interval` miesięcy (`setMonth`). Dzień miesiąca zachowuje się
  naturalnie z `dueDate` (np. due 14-go → kolejne 14-go).
- **YEARLY**: `dueDate + interval` lat.

### ⚠️ Uwaga o `dayOfMonth`
Pole istnieje w interfejsie, ale **UI go nie zapisuje, a `computeNextDue` go nie czyta**.
Dla MONTHLY o właściwy dzień miesiąca dba `dueDate` (przez `setMonth`). Wniosek dla importu:
- **Dzień miesiąca koduj przez `dueDate`** (ustaw termin na właściwy dzień), nie licz na `dayOfMonth`.
- `dayOfMonth` możesz dodać informacyjnie, ale nie zmieni zachowania. Nie polegaj na nim.

### Czego reguła NIE wyraża (ważne przy mapowaniu z arkusza)
`RecurringRule` nie ma pola „miesiąc w roku" ani „konkretna data roczna”. Dlatego:
- „co rok 25 listopada”, „co rok (2 stycznia)”, „1 lipca” → `type:"YEARLY", interval:1`,
  a **konkretną datę zakoduj w `dueDate`** (np. najbliższe 25 listopada). Oryginalny tekst
  warto zachować w `description`.
- „co 1,5 roku” → brak ułamków: użyj `MONTHLY interval:18`.
- „co pół roku” → `MONTHLY interval:6`.
- „co 2 miesiące nieparzyste / co nieparzysty miesiąc” → przybliż `MONTHLY interval:2`
  i zakoduj dzień w `dueDate`.
- Zdarzeniowe / niejednoznaczne („co wyjazd”, „co ile trzeba”, „co ile? Maj”) → ustaw
  `recurring = null` i zachowaj oryginalny opis cykliczności w `description`.

### Mapowanie tekstu PL → reguła (ściąga)
| Tekst źródłowy | RecurringRule |
|---|---|
| „codziennie” | `{type:"DAILY",interval:1}` |
| „co 2 dni” | `{type:"DAILY",interval:2}` |
| „co tydzień” | `{type:"WEEKLY",interval:1}` |
| „co 2 tygodnie” / „co 10 tygodni” | `{type:"WEEKLY",interval:2}` / `{..interval:10}` |
| „pn”,„wt”,„śr”,„czw”,„pt”,„sb”/„co sobotę”,„nd” | `{type:"WEEKLY",interval:1,daysOfWeek:[1..]}` (Pn=1, Wt=2, Śr=3, Czw=4, Pt=5, So=6, Nd=0) |
| „co miesiąc” | `{type:"MONTHLY",interval:1}` (dzień → przez `dueDate`) |
| „co 2/3 miesiące” | `{type:"MONTHLY",interval:2/3}` |
| „co pół roku” | `{type:"MONTHLY",interval:6}` |
| „co 1,5 roku” | `{type:"MONTHLY",interval:18}` |
| „co rok” (+ ewentualna data) | `{type:"YEARLY",interval:1}` (data → przez `dueDate`) |
| „co 2 lata” / „co 3 lata” | `{type:"YEARLY",interval:2/3}` |
| „co ile trzeba”, „co wyjazd”, niejasne | `null` (+ oryginał w `description`) |

> Walidacja zwrotna: tekst z `RecurringBadge.formatRecurring()` powinien z grubsza
> odpowiadać oryginałowi (codziennie / co N dni / co tydzień / dni tygodnia / co N tyg. /
> co miesiąc / co N mies. / co rok / co N lat).

---

## 5. Model `TaskProject` (gdy trzeba utworzyć projekt docelowy, np. „LZ”)

| Pole | Typ | Null? | Default | Uwagi |
|------|-----|-------|---------|-------|
| `id` | `String @id @default(cuid())` | nie | cuid() | W SQL: `gen_random_uuid()::text`. |
| `name` | `String` | nie | — | np. `"LZ"`. |
| `description` | `String?` | tak | `null` | |
| `color` | `String` | nie | `"#6b7280"` | hex. |
| `emoji` | `String` | nie | `"📋"` | |
| `isInbox` | `Boolean` | nie | `false` | Projekt-skrzynka; dla zwykłego projektu `false`. |
| `ownerId` | `String?` | tak | `null` | FK → `User.id`. **Tu wpisz id admina**, by projekt był jego. |
| `ownerTeamId` | `String?` | tak | `null` | Alternatywnie własność zespołu (wykluczające się z `ownerId`). |
| `statusConfig` | `String?` | tak | `null` | JSON `ProjectStatusConfig`; `null` = domyślne statusy systemowe. |
| `createdAt` / `updatedAt` | `DateTime` | nie | now()/auto | W surowym INSERT-cie ustaw `CURRENT_TIMESTAMP`. |

Identyfikacja użytkownika **admin**: w modelu `User` jest `role String @default("USER")`
(`"USER" | "ADMIN"`) oraz tabela `UserRole` (`role "ADMIN"`). Konto właściciela to
`email = 'tyka.szymon@gmail.com'`. Najpewniej w SQL wybrać po e-mailu lub po `role='ADMIN'`.

---

## 6. Kształt JSON na potrzeby importu (rekomendowany)

Jeden obiekt = jedno zadanie. Pola dokładnie jak w modelu (bez relacji). `recurring`
jako **obiekt** (przed wstawieniem do DB serializowany do stringa JSON):

```json
{
  "title": "Backup Maca",
  "description": "— Meta (z arkusza) —\nMiejsce: Katowice\nPilność: !!!",
  "status": "TODO",
  "priority": "URGENT",
  "dueDate": "2026-05-06T00:00:00.000Z",
  "startDate": null,
  "completedAt": null,
  "estimatedMins": 12,
  "recurring": { "type": "MONTHLY", "interval": 1 },
  "category": "Dom",
  "order": 0
}
```

Mapowanie na DB przy INSERT-cie:
- `recurring` → `to_json/​JSON.stringify` → tekst (kolumna `recurring` jest `String?`),
- `projectId` → id projektu „LZ”, `createdById` → id admina,
- `id`/`createdAt`/`updatedAt` → wygenerowane w SQL (`gen_random_uuid()::text`, `CURRENT_TIMESTAMP`).

---

## 7. Checklista dla agenta transformującego
1. `status` zawsze `"TODO"` (chyba że polecenie mówi inaczej).
2. `priority` zmapowane wg §3 (5 poziomów; nadmiarowe poziomy źródła sklej w dół).
3. `estimatedMins` = godziny × 60, **liczba całkowita** (uwaga na przecinek dziesiętny `0,5`→30). Niedające się sparsować (np. śmieciowe „1899-12-31”) → `null`.
4. `dueDate` w ISO 8601 UTC; dla cykliczności rocznej/miesięcznej zakoduj właściwy dzień w `dueDate` (nie w `dayOfMonth`).
5. `recurring` wg §4; gdy cadencja niejasna → `null` + oryginał w `description`.
6. `category` = kontekst źródłowy (swobodny tekst).
7. Dane bez własnego pola (miejsce, pilność, przypisanie, oryginalny tekst cykliczności) → stopka „Meta” w `description`, żeby nic nie zginęło.
8. `order` = indeks pozycji na liście (zachowanie kolejności).
