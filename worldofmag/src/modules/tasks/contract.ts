/**
 * Kontrakt modułu **Zadania** (zadania, projekty, tagi, grupy projektów).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/tasks/*` poza `contract`.
 *
 * | Konsument | Czego potrzebuje |
 * |---|---|
 * | **Nawyki** | `createTask` („zrób z nawyku zadanie") |
 * | **Pogoda** | `createTask` („dodaj pomysł do zadań") |
 * | skrzynka zgłoszeń (`actions/feedback`) | `assertProjectAccess` |
 * | `modules/tasks/lib/access` | `assertProjectAccess` |
 * | narzędzia odczytu asystenta | `getTaskTags`, `getProjectGroups` |
 * | egzekutor akcji asystenta | zadania, projekty, tagi, grupy |
 * | test izolacji najemcy | `assertProjectAccess` |
 *
 * **`createTask` to najczęściej wołana funkcja przez granicę w całym systemie** — i dobrze, że
 * teraz widać ją w jednym miejscu zamiast rozsypaną po importach. Dwa moduły tworzą zadania
 * „przy okazji" swojej pracy; każde takie wywołanie jest teraz jedną linijką w kontrakcie,
 * a nie ukrytą zależnością.
 *
 * Widoki (oś czasu, kanban, podzadania, komentarze, statusy per lista) zostają prywatne.
 */

export {
  createTask,
  updateTask,
  deleteTask,
  updateTaskTags,
  addTaskComment,
} from "./actions/tasks";

export {
  createTaskProject,
  updateTaskProject,
  deleteTaskProject,
  assertProjectAccess,
} from "./actions/taskProjects";

export { getTaskTags, createTaskTag } from "./actions/taskTags";

/**
 * 117: dla restoratora kosza (`src/lib/trash/przywracanie.ts`) — odtworzenie drzewa obszarów
 * z migawki wymaga kolejności rodzic→dziecko; definicja drzewa jest regułą tego modułu,
 * więc wychodzi przez kontrakt (wzorzec `wierszRoslinyZMigawki` z Roślin).
 */
export { sortujTopologicznie, type WezelObszaru } from "./lib/obszary";

export {
  getProjectGroups,
  createProjectGroup,
  updateProjectGroup,
  deleteProjectGroup,
} from "./actions/projectGroups";

/**
 * Slug uprawnienia modułu — dla konsumentów, którzy **sprawdzają dostęp, zanim** utworzą zadanie
 * (Pogoda przy „dodaj pomysł do zadań" pokazuje wtedy zrozumiały komunikat zamiast błędu z guardu).
 * Wyprowadzony z deklaracji, więc nie da się go rozjechać ze źródłem prawdy.
 */
export { default as tasksModule } from "./module";
