import type { JobHandler } from "@/platform/jobs/types";
import { magazynDocumentHandler } from "./magazynDocument";
import { magazynInsightsHandler } from "./magazynInsights";
import { magazynOrderDraftHandler } from "./magazynOrderDraft";
import { magazynScanHandler } from "./magazynScan";

/**
 * Zadania w tle tego modułu. Ładowane LENIWIE przez pole `jobs` w deklaracji — handlery ciągną
 * Prismę i wywołania modelu, więc nie mogą trafić do bundla klienta.
 *
 * Z tej mapy powstaje allowlista `ENQUEUABLE_TYPES`, czyli granica bezpieczeństwa: klient może
 * zakolejkować tylko to, co jakiś moduł zadeklarował.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, JobHandler<any, any>> = {
  "magazyn.document": magazynDocumentHandler,
  "magazyn.insights": magazynInsightsHandler,
  "magazyn.orderDraft": magazynOrderDraftHandler,
  "magazyn.scan": magazynScanHandler,
};

export default handlers;
