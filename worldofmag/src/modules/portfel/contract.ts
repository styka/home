/**
 * Kontrakt modułu **Portfel** (elementy portfela, wpisy, budżety, cele, raporty, waluty).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/portfel/*` poza `contract`.
 *
 * Portfel ma **najwięcej modułów-konsumentów** w całej aplikacji — i to jest jego rola: jest
 * miejscem, w którym ląduje koszt czegokolwiek, co się w systemie wydarzy.
 *
 * | Konsument | Czego potrzebuje |
 * |---|---|
 * | **Usługi** | `addEntry` (rozliczenie płatności), `getWalletElements` (wybór konta w wątku zlecenia) |
 * | **Flota** | `bookAutoExpense`, `removeAutoExpense` (tankowanie i serwis jako wydatek) |
 * | **Zakupy** | `bookAutoExpense` („Zakończ zakupy" księguje koszt listy) |
 * | pulpit | `getWalletOverview` |
 * | narzędzia odczytu asystenta | `getWalletOverview`, `getBudgetsWithSpending`, `getFinanceGoals`, `getMonthlyReport` |
 * | egzekutor akcji asystenta | elementy, wpisy, budżety, cele |
 *
 * **`bookAutoExpense` jest w kontrakcie świadomie, mimo że to helper z `lib/`.** To jedyny sposób,
 * w jaki inne moduły księgują koszt — gdyby go tu nie było, Flota i Zakupy musiałyby albo sięgać do
 * wnętrza Portfela, albo dublować logikę księgowania. Kontrakt ma pokazywać sprzężenie, nie zmuszać
 * do jego obchodzenia.
 *
 * Wielowalutowość, kursy, import CSV z banku i szczegóły raportów zostają prywatne.
 */

export {
  // odczyt
  getWalletOverview,
  getWalletElements,
  // elementy portfela
  createElement,
  updateElement,
  setBalance,
  archiveElement,
  deleteElement,
  // wpisy
  addEntry,
} from "./actions/portfel";

export {
  // budżety i cele
  getBudgetsWithSpending,
  getFinanceGoals,
  createBudget,
  updateBudget,
  deleteBudget,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeGoal,
} from "./actions/portfelBudgets";

export { getMonthlyReport } from "./actions/portfelReports";

/** Księgowanie kosztu z innego modułu — patrz uwaga w nagłówku. */
export { bookAutoExpense, removeAutoExpense } from "./lib/autoExpense";
export type { WynikKsiegowania } from "./lib/autoExpense";
