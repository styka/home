/**
 * Kontrakt modułu **QA** (scenariusze testowe: Epik → Historyjka → Scenariusz).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/qa/*` poza `contract`.
 *
 * QA sprawdza granicę **moduł ↔ powierzchnia administracyjna**. Moduł ma dwie klasy
 * konsumentów i to jest jego cała trudność:
 *
 * - **czytelnicy** (`app/qa/*`, widoki modułu) — przeglądają drzewo scenariuszy,
 * - **autorzy** (`app/admin/qa/*` i `components/admin/qa/*`) — redagują je z panelu admina.
 *
 * Formularze redakcyjne **zostają w `components/admin/`**, bo należą do powierzchni
 * administracyjnej, a nie do modułu — i właśnie dlatego muszą przechodzić przez kontrakt.
 * Gdyby wciągnąć je do środka modułu, granica przestałaby być testowana: wszystko byłoby
 * po tej samej stronie i reguła nie miałaby czego pilnować.
 *
 * Funkcje `*ForAdmin` mają w środku własny guard uprawnień. Kontrakt nie osłabia go ani nie
 * powiela — jest granicą widoczności, nie warstwą autoryzacji.
 */

export {
  // odczyt dla widoków modułu
  getModuleStats,
  getModuleTree,
  getScenarioWithContext,
  getAllEpics,
  // odczyt dla panelu redakcyjnego
  getEpicForAdmin,
  getEpicTreeForAdmin,
  getStoryForAdmin,
  getScenarioForAdmin,
  // redakcja
  createEpic,
  updateEpic,
  deleteEpic,
  createStory,
  updateStory,
  deleteStory,
  createScenario,
  updateScenario,
  deleteScenario,
} from "./actions/qa";

export type { EpicWithCounts, ModuleStats, ModuleTree, ScenarioWithContext, AdminEpicTreeNode } from "./actions/qa";
