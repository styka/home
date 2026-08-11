import type { JobHandler } from "../types";
import { userFactsHandler } from "./userFacts";

/**
 * Zadania w tle, które **nie należą do żadnego modułu**. Dziś jest dokładnie jedno:
 * `user.facts` wnioskuje wiedzę o użytkowniku z jego działań we **wszystkich** modułach naraz,
 * więc przypisanie go do któregokolwiek byłoby arbitralne.
 *
 * `skinGenerate.ts` i `imageInput.ts` leżą obok, ale **celowo nie ma ich w tej mapie**:
 * pierwszy jest wołany synchronicznie z trasy (nigdy nie był zadaniem w kolejce), drugi to wspólny
 * helper wejścia obrazowego. Ta mapa jest źródłem allowlisty `ENQUEUABLE_TYPES` — dopisanie do niej
 * czegokolwiek POSZERZA to, co klient może zakolejkować z przeglądarki.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, JobHandler<any, any>> = {
  "user.facts": userFactsHandler,
};

export default handlers;
