# Plan techniczny: Widoczna „data wykonania" na zadaniach + działające sortowanie sekcji „Zrobione"

- **Spec:** ./spec.md (020-tasks-completed-date-sort)
- **Status:** draft
- **Data:** 2026-07-22

> **Zasada planu:** to jest **JAK**, pod istniejący kod modułu Tasks. Minimalna zmiana schematu (jedna
> nullable kolumna) + wyświetlenie daty na wierszu zadania + widoczne sortowanie sekcji „Zrobione".

## 1. Podejście
Dodajemy trwałe pole `Task.lastCompletedAt` (data ostatniego wykonania), ustawiane przy przetaczaniu
zadania cyklicznego (nowe wystąpienie dostaje datę wykonania poprzedniego). W `TaskRow` pokazujemy
dyskretny znacznik „✓ <data>" gdy zadanie ma **efektywną datę wykonania** = `completedAt ?? lastCompletedAt`.
W `CompletedSection` sortujemy po tej efektywnej dacie malejąco (zachowując auto-rozwinięcie z 018) i
zmieniamy nagłówek sekcji przy aktywnym sortowaniu. Wzorzec: istniejące renderowanie daty terminu w
`TaskRow` (badge `text-xs`, kolory ze zmiennych CSS) i istniejąca logika `CompletedSection`.

## 2. Model danych (Prisma)
- **Zmieniony model:**
  - `Task` — nowe pole: `lastCompletedAt DateTime?` (nullable). Data ostatniego wykonania; dla zadań
    cyklicznych przenoszona na kolejne wystąpienie. Bez enumów (C-12), zwykły typ.
- **Relacje / indeksy:** brak nowych (pole skalarne; nie sortujemy nim w DB — sort jest po stronie
  klienta w `CompletedSection`). `TASK_INCLUDE` używa wyłącznie `include` (relacje), więc **nowa
  kolumna skalarna jest zwracana automatycznie**; `toTask` to zwykły cast — bez zmian w zapytaniach.
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **0207**.
  - Katalog: `prisma/migrations/0207_task_last_completed_at/migration.sql`.
  - DDL: `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastCompletedAt" TIMESTAMP(3);` (nullable, bez
    default — bezpieczne i idempotentne dzięki `IF NOT EXISTS`).
  - Synchronizacja `schema.prisma` (dodanie pola w modelu `Task`).

## 3. Warstwa serwera (Server Actions — C-20)
- Plik: `src/actions/tasks.ts`, funkcja `completeRecurringTask` (~linia 468).
  - Przy tworzeniu `nextTask` (`prisma.task.create`, ~linia 509) dodać do `data`:
    `lastCompletedAt: completedAt` — nowe (aktywne) wystąpienie niesie datę wykonania właśnie zamkniętego.
  - Guard dostępu (C-21): bez zmian — `assertTaskAccess` już jest. `revalidatePath("/tasks")` +
    `revalidatePath("/tasks/<projectId>")` już są na końcu funkcji.
- **Bez zmian** w `updateTask` (zwykłe zadania: `completedAt` już ustawiane przy DONE; ich efektywna
  data = `completedAt`). Nie ruszamy logiki ustawiania `completedAt` (poza zakresem wg speca).
- **Typ TS:** `src/types/index.ts` — dodać `lastCompletedAt: Date | null;` do typu `Task` (obok
  `completedAt`), żeby pole było dostępne w kliencie.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Istniejący `module.tasks`; brak nowych slugów/wpięć.

## 5. UI (C-30, C-31, C-32)

### 5.1 Znacznik „data wykonania" na wierszu zadania — AC-1, AC-4, AC-6
- Plik: `src/components/tasks/TaskRow.tsx`.
- Dodać mały, dyskretny znacznik obok istniejących meta (po dacie terminu / czasie): gdy
  `doneDate = task.completedAt ?? task.lastCompletedAt` istnieje →
  `<span className="text-xs" style={{ color: "var(--text-muted)" }}><Check size={10}/> {formatDoneDate(doneDate)}</span>`.
  `Check` jest już importowany.
- `formatDoneDate(date)`: krótka data lokalna pl-PL — `toLocaleDateString("pl-PL", { day:"numeric",
  month:"short" })`, z rokiem gdy inny niż bieżący; (wzór jak else-branch istniejącego `formatDate`).
- Efekt: w sekcji „Zrobione" ukończone zadania pokazują datę ukończenia; aktywne **cykliczne**
  wystąpienia pokazują datę **poprzedniego** wykonania (`lastCompletedAt`). Kolory ze zmiennych (C-30),
  tekst PL (C-32). Dyskretny (`text-muted`), by nie zaśmiecać (założenie speca §8).

### 5.2 Widoczne, działające sortowanie sekcji „Zrobione" — AC-1, AC-2, AC-3
- Plik: `src/components/tasks/CompletedSection.tsx`.
  - Sort: zmienić klucz z `completedAt` na **efektywną datę** `completedAt ?? lastCompletedAt`
    (malejąco). Brak daty → na koniec.
  - Nagłówek: gdy `sortBy === "completedAt"` → etykieta `"✓ Zrobione / Anulowane — wg daty wykonania"`;
    inaczej dotychczasowa `"✓ Zrobione / Anulowane"`.
  - Zachować z 018: `key={sortBy}` + `defaultOpen={sortBy === "completedAt"}` (auto-rozwinięcie).
- Stan aktywny przycisku sortu (`TasksPage.tsx`) już jest (`accent-blue`) — bez zmian (AC-2).
- Zakres renderowania sekcji (tylko filtr „ALL") — bez zmian (spec: poza zakresem).

### 5.3 Bez zmian w innych widokach
- Widoki dziś/upcoming/overdue/priorytety renderują `TaskRow`, więc znacznik „✓ data" pojawi się tam
  automatycznie **tylko** gdy zadanie ma `completedAt`/`lastCompletedAt` (aktywne cykliczne) — to
  zamierzone i pożądane (AC-4), bez regresji dla zwykłych aktywnych zadań (oba pola null → brak znacznika).

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak `AIAction`/read-toola/kalendarza/powiadomień. `check:actions` zostaje zielony.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/prisma/schema.prisma` | edycja | Dodanie `lastCompletedAt DateTime?` do `Task` |
| `worldofmag/prisma/migrations/0207_task_last_completed_at/migration.sql` | nowy | ALTER TABLE — nowa kolumna |
| `worldofmag/src/types/index.ts` | edycja | `lastCompletedAt: Date \| null` w typie `Task` |
| `worldofmag/src/actions/tasks.ts` | edycja | `completeRecurringTask`: `lastCompletedAt: completedAt` na nowym wystąpieniu |
| `worldofmag/src/components/tasks/TaskRow.tsx` | edycja | Znacznik „✓ data wykonania" (`completedAt ?? lastCompletedAt`) |
| `worldofmag/src/components/tasks/CompletedSection.tsx` | edycja | Sort po efektywnej dacie + nagłówek wg sortu |
| `specs/020-tasks-completed-date-sort/manual-test.md` | nowy | Manualny scenariusz testowy (AC-7) |
| `doświadczenia.md` (root) | edycja | C-51: lekcja (dlaczego sort „nie dawał różnicy" + data ostatniego wykonania) |

## 8. Bramki i weryfikacja (C-50)
- Lokalny Postgres (C-13): eksport `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate
  deploy` (zaaplikuje 0207), `prisma generate`. **Nie** `scripts/migrate.js` na prod.
- `npm run check:migrations` (0207 unikalny → zielone), `npm run check:actions` (zielone),
  `next lint --dir src`, `next build`.
- Mapowanie AC → weryfikacja:
  - **AC-1** — filtr „Wszystkie": po kliknięciu sortu sekcja rozwinięta, wiersze z datą, malejąco po
    dacie (prześledzenie `CompletedSection` sortu + `TaskRow` znacznika).
  - **AC-2** — ponowny klik → `sortBy="default"` → oryginalna kolejność; stan przycisku wraca.
  - **AC-3** — nagłówek sekcji zmienia się przy aktywnym sortowaniu.
  - **AC-4/AC-5** — `completeRecurringTask` ustawia `lastCompletedAt` na nowym wystąpieniu (kod);
    znacznik na aktywnym cyklicznym pokazuje tę datę; pole trwałe w DB (migracja).
  - **AC-6** — zwykłe aktywne zadania: oba pola null → brak znacznika; inne widoki bez regresji.
  - **AC-7** — plik `manual-test.md` z krokami i oczekiwanym rezultatem.

## 9. Ryzyka techniczne i plan wycofania
- **Ryzyko:** migracja na prod (kolumna). Mitygacja: `ADD COLUMN IF NOT EXISTS`, nullable, bez default
  — nieblokujące, bez backfill. Rollback: kod odwracalny; kolumna może zostać (nieużywana) — nie
  robimy `DROP` na prod bez potrzeby (runbook: rollback kodu ≠ rollback migracji).
- **Ryzyko:** znacznik „✓ data" jako szum na wielu ukończonych zadaniach. Mitygacja: dyskretny
  `text-muted`, krótka data; pojawia się głównie w (domyślnie zwiniętej) sekcji „Zrobione" i na
  aktywnych cyklicznych.
- **Ryzyko:** stare cykliczne bez `lastCompletedAt`. Mitygacja: świadomie poza zakresem — pojawi się od
  następnego wykonania (ujęte w scenariuszu testowym).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — ręczna migracja 0207, numer z `next:migration`, nullable, bez enumu.
- [x] C-20..C-25 — zmiana zapisu w Server Action `completeRecurringTask` z istniejącym `revalidatePath`
  i guardem; brak RBAC/AI/trash/audit.
- [x] C-30..C-32 — znacznik/nagłówek na zmiennych CSS, teksty PL, mobile bez regresji (badge `text-xs`).
- [x] C-53 (minimalizm) — jedna kolumna + drobne zmiany widoku; bez nowych zależności/abstrakcji.
