/**
 * Kontrakt modułu **Pogoda** (prognoza, lokalizacje, obserwatory, „Co robić?" i biblioteka pomysłów).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/weather/*` poza `contract`.
 *
 * Konsumenci: narzędzia odczytu asystenta (`agentTools`) i egzekutor jego akcji.
 *
 * Pomysły („Co robić?"), plany szczegółowe i mapa wyboru lokalizacji zostają prywatne — to własny
 * widok modułu. W drugą stronę Pogoda **sama jest konsumentem**: przy „dodaj pomysł do zadań" woła
 * `createTask` z kontraktu Zadań.
 */

export {
  // odczyt
  getWeather,
  getLocations,
  getWatchers,
  // lokalizacje
  addLocationByName,
  deleteLocation,
  setDefaultLocation,
  // obserwatory
  addPresetWatcher,
  addCustomWatcher,
  updateWatcher,
  deleteWatcher,
} from "./actions/weather";
