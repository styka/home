/**
 * Kontrakt modułu **Flota** (pojazdy, tankowania, serwis, załączniki).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/flota/*` poza `contract`.
 *
 * Konsumenci:
 * - **pulpit** (`app/page.tsx`) → `getVehicles`,
 * - **egzekutor akcji asystenta** → pojazdy, tankowania, wpisy serwisowe.
 *
 * Szczegóły pojazdu, załączniki (faktury, dowód, polisa) i wyliczenia kosztu posiadania
 * (`lib/flota`) zostają prywatne — obsługuje je własna trasa modułu.
 */

export {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  addFuelLog,
  addServiceRecord,
} from "./actions/flota";

// 115 (Z-INT-14): Truck liczy koszt paliwa trasy ze średnich pojazdu — czyste funkcje
// nad `fuelLogs`, które `getVehicles` i tak już zwraca. Bez nowej akcji.
export { computeConsumption, avgFuelPrice, type FuelLogLike } from "./lib/flota";
export type { VehicleWithStats } from "./actions/flota";
