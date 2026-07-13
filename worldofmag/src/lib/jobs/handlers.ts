// Z-131 (T-17) — rejestr handlerów zadań. JEDNO miejsce mapujące `type` → funkcję.
// `ENQUEUABLE_TYPES` to allowlista typów, które KLIENT może zakolejkować przez API
// (bezpieczeństwo: nie pozwalamy odpalać dowolnego handlera z przeglądarki).

import type { JobHandler } from "@/lib/jobs/types";
import { kitchenOcrImageHandler } from "@/lib/jobs/handlers/kitchenOcrImage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JOB_HANDLERS: Record<string, JobHandler<any, any>> = {
  "kitchen.ocrImage": kitchenOcrImageHandler,
};

/** Typy, które wolno zakolejkować z klienta (przez POST /api/jobs). */
export const ENQUEUABLE_TYPES = new Set<string>(Object.keys(JOB_HANDLERS));

export function getHandler(type: string): JobHandler | undefined {
  return JOB_HANDLERS[type];
}
