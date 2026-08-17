/**
 * 071 (zadanie 22) — KORZEŃ KOMPOZYCJI SUBSKRYPCJI ZDARZEŃ.
 *
 * **Dlaczego osobny korzeń, a nie pole w `ModuleServerContributions`.** Bo 050 to już zmierzyło
 * i opisało: wspólny rejestr leniwych loaderów jest **plikiem zbiorczym** — kto importuje go dla
 * jednego pola, dostaje do grafu cele `import()` **wszystkich** pozostałych. Wkłady pulpitu wpięte
 * tamtą drogą podniosły graf strony głównej z 1889 do 2117 modułów i dlatego dostały własny korzeń
 * (`dashboardContributors.ts`). Subskrypcje idą tym samym wzorcem.
 *
 * Tu cena byłaby zresztą płacona w drugą stronę: to worker zdarzeń wciągnąłby egzekutory asystenta
 * i handlery zadań w tle siedemnastu modułów, których nigdy nie zawoła.
 *
 * Platforma tego pliku **nie importuje** — dostaje rezolwer wstrzyknięty (C-36).
 */

import type { EventContribution, EventSubscriber, DomainEventRecord } from "@/platform/events/subscriber";
import { setEventSubscriberResolver } from "@/platform/events/dispatch";
import { startEventWorker } from "@/platform/events/worker";

/** Leniwe loadery wkładów. Moduł bez reakcji po prostu tu nie występuje. */
const WKLADY: Record<string, () => Promise<{ default: EventContribution }>> = {
  shopping: () => import("@/modules/shopping/events"),
  portfel: () => import("@/modules/portfel/events"),
};

/** Cache wczytanych wkładów — worker chodzi w pętli, nie ma po co ładować ich za każdym razem. */
let zaladowane: EventSubscriber[] | null = null;

async function wszyscySubskrybenci(): Promise<EventSubscriber[]> {
  if (zaladowane) return zaladowane;
  const listy = await Promise.all(Object.values(WKLADY).map(async (load) => (await load()).default.subscribers));
  zaladowane = listy.flat();
  return zaladowane;
}

/** Rezolwer dla workera: subskrybenci zainteresowani tym konkretnym zdarzeniem. */
export async function subscribersForEvent(event: DomainEventRecord): Promise<EventSubscriber[]> {
  const wszyscy = await wszyscySubskrybenci();
  return wszyscy.filter((s) => s.on.includes(event.type));
}

/** Wszystkie zadeklarowane subskrypcje — dla bramki i diagnostyki. */
export async function wszystkieSubskrypcje(): Promise<EventSubscriber[]> {
  return wszyscySubskrybenci();
}

/**
 * Startuje worker zdarzeń, wstrzykując mu rezolwer. Idempotentne.
 *
 * **Nie w `instrumentation.ts`**, dokładnie z tego samego powodu co worker kolejki (Z-131):
 * `instrumentation.ts` jest bundlowane także dla runtime EDGE, a łańcuch subskrybentów sięga kodu
 * node-only. Startujemy więc leniwie z tras API działających w runtime Node — tak jak
 * `ensureJobWorker()`.
 */
export function ensureEventWorker(): void {
  setEventSubscriberResolver(subscribersForEvent);
  startEventWorker();
}
