/**
 * Kontrakt modułu **Zwierzęta** (profile, opieka, hodowla i terrarystyka, rozród).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/pets/*` poza `contract`.
 *
 * Konsumenci:
 * - **pulpit** (`app/page.tsx`) → `getCareAgenda`,
 * - **narzędzia odczytu asystenta** → `getCareAgenda`, `getCareHistory`, `getPetWelfare`, `getEnclosures`,
 * - **egzekutor akcji asystenta** → profile, zabiegi, terraria,
 * - **test izolacji najemcy** → guard `assertPetAccess` (wyjątek jak w Kuchni: test jest generowany
 *   i musi widzieć guardy wszystkich modułów).
 *
 * Genetyka, eksport dla weterynarza, alarmy środowiskowe i cały rozród zostają prywatne — to
 * mechanika własnych widoków, po którą nikt z zewnątrz nie sięga.
 */

export {
  updatePet,
  setPetStatus,
  deletePet,
  assertPetAccess,
} from "./actions/pets";

export {
  getCareAgenda,
  getCareHistory,
  getPetWelfare,
  completeTreatment,
} from "./actions/petCare";

export {
  getEnclosures,
  updateEnclosure,
  deleteEnclosure,
  assignPetToEnclosure,
} from "./actions/petHusbandry";
