import type { JobHandler } from "@/platform/jobs/types";
import { petsInsightsHandler } from "./petsInsights";

/**
 * Zadania w tle tego modułu. Ładowane LENIWIE przez pole `jobs` w deklaracji — handlery ciągną
 * Prismę i wywołania modelu, więc nie mogą trafić do bundla klienta.
 *
 * Z tej mapy powstaje allowlista `ENQUEUABLE_TYPES`, czyli granica bezpieczeństwa: klient może
 * zakolejkować tylko to, co jakiś moduł zadeklarował.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, JobHandler<any, any>> = {
  "pets.insights": petsInsightsHandler,
};

export default handlers;
