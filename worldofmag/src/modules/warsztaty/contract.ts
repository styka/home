/**
 * Kontrakt modułu **Warsztaty** (warsztat, wyposażenie, przeglądy, projekty w trybie Pro).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/warsztaty/*` poza `contract`.
 *
 * Moduł ma **23 eksporty akcji**, a kontrakt wystawia **jedenaście** — dokładnie to, czego używają
 * dwaj konsumenci:
 * - `lib/ai/agentTools.ts` → `getMaintenanceOverview` (agenda przeglądów i niskich stanów),
 * - `lib/ai/executors/warsztatExecutor.ts` → operacje na warsztacie, wyposażeniu i projektach.
 *
 * Ustawienia trybu Dom/Pro, listy warsztatów i szczegóły pozostają **prywatne**: obsługuje je własna
 * trasa modułu, a wystawienie ich „na wszelki wypadek" zamieniłoby kontrakt w drugi spis eksportów.
 */

export {
  // odczyt
  getMaintenanceOverview,
  // warsztat
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  // wyposażenie
  addWorkshopItem,
  updateWorkshopItem,
  deleteWorkshopItem,
  adjustWorkshopItemQuantity,
  // projekty (Pro)
  addWorkshopProject,
  updateWorkshopProject,
  deleteWorkshopProject,
} from "./actions/warsztat";

export type { MaintenanceOverview } from "./actions/warsztat";
