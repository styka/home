/**
 * Kontrakt modułu **Rośliny** (przestrzenie roślinne, opieka, dziennik, katalog gatunków,
 * ewidencja zabiegów).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/rosliny/*` poza `contract`.
 *
 * Konsumenci (i nic ponadto — kontrakt niesie to, czego ktoś potrzebuje, nie „wszystko na wszelki
 * wypadek", C-36):
 * - **wkład do pulpitu** (`dashboard.ts`) → `getCareAgenda`,
 * - **wkład do kalendarza** (`calendar.ts`) → `getCareAgenda`,
 * - **narzędzia odczytu asystenta** → `getSpaces`, `getPlants`, `getCareAgenda`,
 * - **egzekutor akcji asystenta** → `createSpace`, `createPlant`, `recordCare`, `addMeasurement`,
 * - **test izolacji najemcy** → guardy `assertSpaceAccess` i `assertPlantAccess` (wyjątek jak
 *   w Kuchni i Zwierzętach: test jest generowany i musi widzieć guardy wszystkich modułów),
 * - **kosz** (`src/actions/trash.ts`, agregat warstwy aplikacji) → `wierszRoslinyZMigawki`:
 *   odczyt migawki jest regułą tego modułu (co wolno uzupełnić domyślną, a czego nie), więc
 *   mieszka tu razem z testem, a nie w pliku akcji kosza.
 *
 * **Co zostaje prywatne i dlaczego.** Miejsca, gatunki, zbiory, ewidencja zabiegów, dziennik,
 * reguła terminu i reguła płodozmianu to mechanika własnych widoków — nikt z zewnątrz po nie nie
 * sięga. Ewidencja w szczególności: to dokument o wymogu ustawowym, a nie dana do współdzielenia,
 * i gdyby kiedyś miała opuścić moduł, będzie to osobna, świadoma decyzja.
 */

export {
  getSpaces,
  createSpace,
  assertSpaceAccess,
} from "./actions/przestrzenie";

export {
  getPlants,
  createPlant,
  assertPlantAccess,
} from "./actions/rosliny";

export {
  getCareAgenda,
  recordCare,
} from "./actions/opieka";

export { addMeasurement } from "./actions/dziennik";

export { wierszRoslinyZMigawki, type WierszRosliny } from "./domain/kosz";
