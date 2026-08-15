/**
 * 071 (zadanie 22) — OBIEG WORKERA ZDARZEŃ. Startowany raz z `instrumentation.ts`.
 *
 * Bliźniak `platform/jobs/worker.ts` co do kształtu (C-53): ten sam guard singletona przetrwały
 * przeładowanie modułów w trybie deweloperskim, ten sam styl pętli.
 *
 * **Bez `LISTEN/NOTIFY`, świadomie.** Rozdz. 9.4.3 dopuszcza je albo Redis Pub/Sub, ale oba wymagają
 * surowego połączenia poza Prismą — czyli **nowej zależności** — a kupują wyłącznie **niższe
 * opóźnienie** względem obiegu co kilka sekund. Opóźnienie zaczyna mieć znaczenie dopiero przy
 * kanale czasu rzeczywistego (zadanie 23) i tam ta decyzja ma realny wymóg; tutaj byłaby
 * zależnością na zapas (C-53).
 */

import { reportServerError } from "@/lib/observability/report";
import { obiegZdarzen } from "./dispatch";

const TICK_MS = 5000;

const g = globalThis as unknown as { __omniaEventWorker?: { timer: NodeJS.Timeout | null } };

async function tick(): Promise<void> {
  try {
    // Pętla do wyczerpania partii: gdy zdarzeń jest więcej niż mieści partia, nie czekamy
    // kolejnych pięciu sekund na każdą z nich.
    for (;;) {
      const wynik = await obiegZdarzen();
      if (wynik.przetworzone === 0) break;
    }
  } catch (err) {
    reportServerError(err, { scope: "events.worker" });
  }
}

/** Startuje obieg. Wielokrotne wywołanie jest bezpieczne (guard singletona). */
export function startEventWorker(): void {
  if (g.__omniaEventWorker?.timer) return;
  g.__omniaEventWorker = { timer: setInterval(() => void tick(), TICK_MS) };
  void tick();
}

/** Zatrzymuje obieg — używane w testach, żeby worker nie zjadał zdarzeń spod nich. */
export function stopEventWorker(): void {
  if (g.__omniaEventWorker?.timer) clearInterval(g.__omniaEventWorker.timer);
  g.__omniaEventWorker = { timer: null };
}
