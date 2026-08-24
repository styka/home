import type { JobHandler } from "@/platform/jobs/types";
import { feedbackTitleHandler } from "./feedbackTitle";

/**
 * Zadania w tle tego modułu. Ładowane LENIWIE przez pole `jobs` w `module.server.ts` — handlery
 * ciągną Prismę i wywołania modelu, więc nie mogą trafić do bundla klienta.
 *
 * Z tej mapy powstaje allowlista kolejkowania (granica bezpieczeństwa): klient może zakolejkować
 * tylko to, co jakiś moduł zadeklarował.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, JobHandler<any, any>> = {
  "tasks.feedbackTitle": feedbackTitleHandler,
};

export default handlers;
