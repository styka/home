import type { JobHandler } from "@/platform/jobs/types";
import { youtubeRefreshHandler } from "./youtubeRefresh";

/**
 * Zadania w tle tego modułu. Z tej mapy powstaje allowlista `ENQUEUABLE_TYPES`, czyli **granica
 * bezpieczeństwa**: klient może zakolejkować wyłącznie to, co jakiś moduł zadeklarował.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, JobHandler<any, any>> = {
  "youtube.refresh": youtubeRefreshHandler,
};

export default handlers;
