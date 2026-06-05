-- Raport implementacyjny: pełne zarządzanie statusami zadań (własne statusy per-lista).
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-05 (statusy zadań)',
  'omnia-implementacja-2026-06-05-statusy-zadan',
  $omnia_task_statuses$# Omnia — Raport implementacji 2026-06-05

Sesja realizuje jedno zgłoszenie: **pełne zarządzanie statusami listy zadań** —
dodawanie własnych statusów, usuwanie ich oraz włączanie/wyłączanie i zmiana
kolejności/ścieżki, przy czym statusy **systemowe** można tylko włączać/wyłączać
(nigdy usuwać), a statusy **użytkownika** działają tak samo jak systemowe plus dają
się edytować i usuwać.

---

## Pełne zarządzanie statusami zadań (system + własne) per lista
**Diagnoza:** Każda lista zadań (`TaskProject`) miała konfigurację statusów w polu JSON
`TaskProject.statusConfig` (`{ enabled, chain }`), a edytor „Statusy listy" pozwalał
jedynie włączać/wyłączać, przestawiać kolejność i ustawiać ścieżkę przejść dla **sześciu
zaszytych** statusów systemowych (`SYSTEM_TASK_STATUSES`). Nie było jak dodać własnego
statusu ani niczego usunąć. Wymaganie: własny status ma te same atrybuty co systemowy
(nazwa, kolor, ikona, flaga „zamykający"), z usuwaniem **zablokowanym, gdy status jest
w użyciu** przez zadania; statusy systemowe — bez usuwania.

**Rozwiązanie:** Świadomie **bez migracji schematu DB** — `Task.status` to już `String`,
a konfiguracja statusów listy już mieszka w polu JSON `statusConfig`. Dlatego własne
statusy dołożono jako `custom: CustomTaskStatus[]` do tego samego JSON-a, a pola
`enabled`/`chain` rozluźniono z `TaskStatus[]` do `string[]`, by mieściły klucze własnych
statusów (`c_<losowy>`). Powstały dwa centralne resolwery — `resolveStatuses(config)` i
`statusMetaFor(key, config)` — które zastąpiły zaszyte `statusMeta`/`STATUS_ICONS`/
`TASK_STATUS_FILTER_LABELS` w całej warstwie renderującej (wiersz zadania, zakładki
filtrów, lista, panel szczegółów, strona). Dzięki temu metadane statusu (etykieta, kolor,
ikona, „terminalność") pochodzą z konfiguracji konkretnej listy, a nie ze stałych w kodzie.

Edytor „Statusy listy" rozbudowano o formularz dodawania (nazwa + paleta kolorów akcentów
+ picker ikon + checkbox „zamykający"), edycję i usuwanie własnych statusów; systemowe
pozostają nieusuwalne i nieedytowalne (tylko włącz/wyłącz + kolejność + ścieżka). Ikony
obsługuje mały rejestr `StatusIcon` (nazwa→komponent Lucide, fallback `Circle`), wspólny
dla edytora i wiersza zadania. Blokadę usunięcia wymusza server action
`updateTaskProjectStatusConfig`: dla każdego usuwanego klucza własnego liczy
`prisma.task.count({ projectId, status: key })` i przy >0 rzuca czytelny błąd z liczbą
zadań (usunięcie możliwe dopiero po przeniesieniu zadań). „Terminalność" własnego statusu
jest respektowana wszędzie tam, gdzie dotąd twardo sprawdzano `DONE`/`CANCELLED` (widok
aktywnych, sekcja „zakończone", przekreślenie/wyszarzenie wiersza).

**Zmienione pliki:**
- `src/types/index.ts` — typy `CustomTaskStatus`/`ResolvedStatus`, `enabled/chain: string[]` + `custom?`, ikony w `SYSTEM_TASK_STATUSES`, resolwery `resolveStatuses`/`statusMetaFor`, `parse`/`serializeStatusConfig` z obsługą własnych statusów.
- `src/components/tasks/StatusIcon.tsx` — nowy rejestr ikon + `STATUS_ICON_OPTIONS`.
- `src/components/tasks/TaskStatusConfigEditor.tsx` — dodawanie/edycja/usuwanie własnych statusów (systemowe tylko włącz/wyłącz).
- `src/actions/taskProjects.ts` — walidacja własnych statusów + blokada usunięcia statusu w użyciu.
- `src/actions/tasks.ts` — rozluźnienie typu zapisu statusu do `string` (klucze własne).
- `src/components/tasks/TaskRow.tsx`, `TaskList.tsx`, `TaskFilters.tsx`, `TasksPage.tsx`, `TaskDetail.tsx` — render statusów przez resolwer + przekazanie konfiguracji listy i etykiet.
- `doświadczenia.md` — lekcja o rozszerzaniu konfiguracji w polu JSON i centralnym resolwerze.

## Podsumowanie
Jedno zadanie, zamknięte minimalnym, nieinwazyjnym rozwiązaniem: rozszerzenie istniejącej
konfiguracji JSON listy zamiast nowej tabeli, plus jeden centralny resolwer metadanych
statusu przekazywany w dół drzewa komponentów. Główne obszary zmian: model/typy statusów
(`types`), edytor konfiguracji listy, server action z walidacją i blokadą usunięcia oraz
warstwa renderująca module Zadań. Weryfikacja: `node scripts/check-action-coverage.js`
(czysto), `npx prisma generate`, `next build` (kompilacja i type-check bez błędów;
`UntrustedHost` przy prerenderze nieszkodliwe). Raport zapisany przez migrację → trafia do
`/reports` na deployu `develop`.
$omnia_task_statuses$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
