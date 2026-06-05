-- Raport implementacyjny: po szybkim dodaniu zadania otwórz jego szczegóły.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-05 (otwieranie nowego zadania)',
  'omnia-implementacja-2026-06-05-otwieranie-nowego-zadania',
  $omnia_quick_add_open$# Omnia — Raport implementacji 2026-06-05

Sesja realizuje jedno zgłoszenie z listy zadań modułu **Zadania**: po dodaniu
zadania przez szybkie dodawanie z poziomu listy, nowo utworzone zadanie ma się
od razu wyświetlić, by można było ustawić jego pozostałe parametry.

---

## Po szybkim dodaniu zadania otwórz jego szczegóły
**Diagnoza:** Pasek „Dodaj zadanie…" (`QuickAddTask`) pozwala ustawić jedynie tytuł,
priorytet i termin. Po wysłaniu formularza zadanie powstawało, lista się odświeżała,
ale panel szczegółów się **nie otwierał** — żeby ustawić resztę parametrów (opis,
projekt, daty, tagi, status, przypisanie, cykliczność) użytkownik musiał osobno
odszukać świeżo dodane zadanie na liście i je kliknąć. Wymaganie: nowe zadanie ma
się od razu pokazać w panelu szczegółów.

**Rozwiązanie:** Minimalna zmiana, bez ruszania modelu danych ani server action —
`createTask` już zwraca utworzone zadanie (`Task` z pełnym `include`), więc wystarczyło
przekazać jego `id` w górę. `QuickAddTask` dostał opcjonalny callback `onCreated(taskId)`
wywoływany po sukcesie (po wyczyszczeniu pól), a `TasksPage` podpina go tak, by ustawić
`openTaskId` oraz `focusedTaskId` na nowe zadanie. Panel szczegółów (`TaskDetail`) renderuje
się wtedy, gdy zadanie jest w propsie `tasks` — `revalidatePath("/tasks")` z `createTask`
dociąga świeżą listę z serwerem, więc po odświeżeniu nowe zadanie jest odnajdywane przez
`tasks.find(...)` i panel pojawia się sam (na desktopie z boku, na mobile jako modal pełnoekranowy).
Reużyto istniejącego mechanizmu otwierania szczegółów (ten sam `setOpenTaskId`, którego
używa klik w wiersz i skrót `e`), więc zachowanie „wstecz zamyka panel" i obsługa Esc działają
bez zmian.

**Zmienione pliki:**
- `src/components/tasks/QuickAddTask.tsx` — nowy opcjonalny prop `onCreated`, przechwycenie zwróconego zadania z `createTask` i wywołanie callbacku z jego `id`.
- `src/components/tasks/TasksPage.tsx` — podpięcie `onCreated` do `QuickAddTask`: ustawia `openTaskId` i `focusedTaskId` na nowo utworzone zadanie, otwierając panel szczegółów.

## Podsumowanie
Jedno zadanie, zamknięte minimalną zmianą po stronie klienta (dwa pliki, bez migracji
schematu ani zmian w server action). Główny obszar zmian: moduł Zadania — przepływ
szybkiego dodawania. Wykorzystano fakt, że `createTask` już zwraca pełny obiekt zadania,
oraz istniejący stan `openTaskId`/`focusedTaskId` sterujący panelem szczegółów.
Weryfikacja: `next build` przechodzi (kompilacja i type-check bez błędów). Raport zapisany
przez migrację → trafia do `/reports` na deployu `develop`.
$omnia_quick_add_open$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
