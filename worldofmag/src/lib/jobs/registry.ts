import type { JobHandler } from "@/platform/jobs/types";
import { MODULE_SERVER } from "@/lib/modules.server";
import platformHandlers from "@/platform/jobs/handlers";
import { setJobHandlerResolver, setRetentionPolicies, startJobWorker } from "@/platform/jobs/worker";
import { POLITYKI_RETENCJI } from "@/lib/retention/polityki";

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

  for (const [id, server] of Object.entries(MODULE_SERVER)) {
    if (!server.jobs) continue;
    const mod = await server.jobs();
    for (const [type, handler] of Object.entries(mod.default)) {
      if (all[type]) {
        // Dwa moduły deklarujące ten sam typ zadania po cichu nadpisałyby się nawzajem.
        throw new Error(`Zduplikowany typ zadania „${type}" — deklaruje go moduł „${id}" i ktoś jeszcze.`);
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
  // 083 (zadanie 30): retencja jedzie tym samym okresowym tyknięciem co sprzątanie kolejki, ale jej
  // polityki muszą przyjść stąd — dwie z siedmiu opisują dane modułowe, a platforma modułów nie zna.
  setRetentionPolicies(POLITYKI_RETENCJI);
  startJobWorker();
}
