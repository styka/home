import type { JobHandler } from "@/platform/jobs/types";
import { MODULES } from "@/lib/modules";
import platformHandlers from "@/platform/jobs/handlers";
import { setJobHandlerResolver, startJobWorker } from "@/platform/jobs/worker";

/**
 * 049 — REJESTR ZADAŃ W TLE SKŁADANY Z DEKLARACJI.
 *
 * Wcześniej `JOB_HANDLERS` była ręczną mapą dwunastu wpisów w jednym pliku, a wynikająca z niej
 * `ENQUEUABLE_TYPES` — **granicą bezpieczeństwa**: listą tego, co wolno zakolejkować z przeglądarki.
 * Ręczna lista przy granicy bezpieczeństwa to zaproszenie do rozjazdu; teraz zbiór dozwolonych
 * typów jest **pochodną** tego, co moduły faktycznie zadeklarowały.
 *
 * Składanie jest asynchroniczne (pole `jobs` jest leniwe, bo handlery ciągną Prismę i model)
 * i zapamiętane — worker odpytuje rejestr przy każdym zadaniu.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handlers = Record<string, JobHandler<any, any>>;

let cached: Promise<Handlers> | null = null;

async function load(): Promise<Handlers> {
  // Zadania przekrojowe (wiedza o użytkowniku, skórki, wejście obrazowe) nie należą do żadnego
  // modułu — wnosi je platforma.
  const all: Handlers = { ...platformHandlers };

  for (const m of MODULES) {
    if (!m.jobs) continue;
    const mod = await m.jobs();
    for (const [type, handler] of Object.entries(mod.default)) {
      if (all[type]) {
        // Dwa moduły deklarujące ten sam typ zadania po cichu nadpisałyby się nawzajem.
        throw new Error(`Zduplikowany typ zadania „${type}" — deklaruje go moduł „${m.id}" i ktoś jeszcze.`);
      }
      all[type] = handler;
    }
  }
  return all;
}

export function getJobHandlers(): Promise<Handlers> {
  if (!cached) cached = load();
  return cached;
}

/** Czy klient może zakolejkować ten typ zadania (allowlista = to, co zadeklarowały moduły). */
export async function isEnqueuable(type: string): Promise<boolean> {
  return Object.prototype.hasOwnProperty.call(await getJobHandlers(), type);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getHandler(type: string): Promise<JobHandler<any, any> | undefined> {
  return (await getJobHandlers())[type];
}

/**
 * Start workera z **wstrzykniętym** rejestrem. Trasy wołają to zamiast `startJobWorker()`:
 * worker nie zna deklaracji modułów i nie ma prawa ich poznać (C-36), więc rozwiązywanie
 * handlera musi mu przyjść z zewnątrz. Idempotentne — `startJobWorker` samo pilnuje singletona.
 */
export function ensureJobWorker(): void {
  setJobHandlerResolver(getHandler);
  startJobWorker();
}
