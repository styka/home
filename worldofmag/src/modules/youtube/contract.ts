/**
 * Kontrakt modułu **YouTube**.
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/youtube/*` poza `contract`.
 *
 * Konsumentem jest asystent AI: potrafi pokazać, co nowego na obserwowanych kanałach, i uruchomić
 * odświeżenie na prośbę użytkownika. **Reszta modułu zostaje prywatna** — zarządzanie kanałami,
 * transkrypcje, streszczenia i szukanie to mechanika własnego widoku. Kontrakt niesie dokładnie to,
 * czego potrzebują konsumenci, a nie „wszystko na wszelki wypadek" (C-36).
 */

export { getFilmy, odswiezYoutube } from "./actions/filmy";

/**
 * Przepływ zgody Google — dla CIENKICH tras w `src/app/api/youtube/*`. Trasa robi wyłącznie to,
 * czego moduł zrobić nie może (ciasteczko + przekierowanie); kolejność kroków zostaje tutaj.
 */
export { przygotujZgode, zapiszZgode, YOUTUBE_STATE_COOKIE } from "./lib/zgoda";
export type { WynikZgody } from "./lib/zgoda";
export type { FilmDTO, StanFilmu, SortFilmow } from "./actions/filmy";
