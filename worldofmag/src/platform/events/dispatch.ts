/**
 * 071 (zadanie 22, rozdz. 9.4.3) — ROZSYŁKA ZDARZEŃ DO SUBSKRYBENTÓW.
 *
 * Platforma **nie zna** listy subskrybentów — dostaje rezolwer wstrzyknięty przez korzeń
 * kompozycji, dokładnie tak jak worker kolejki zadań dostaje rezolwer handlerów (049).
 * Parametr jest **wymagany**: wartość domyślna „na razie" byłaby tym cichym obejściem C-36,
 * którego ta reguła zabrania.
 */

import { reportServerError } from "@/lib/observability/report";
import type { DomainEventRecord, EventSubscriber } from "./subscriber";
import { przetworzPartie } from "./queue";

export type SubscriberResolver = (event: DomainEventRecord) => Promise<EventSubscriber[]>;

let rozwiazSubskrybentow: SubscriberResolver | null = null;

/** Wołane RAZ przez korzeń kompozycji, zanim wystartuje worker. */
export function setEventSubscriberResolver(resolver: SubscriberResolver): void {
  rozwiazSubskrybentow = resolver;
}

/** Wynik jednego obiegu — do logów i testów. */
export interface WynikObiegu {
  przetworzone: number;
  dostarczone: number;
  bledy: number;
}

/**
 * Jeden obieg: rezerwuje partię, woła subskrybentów, oznacza dostarczone.
 *
 * **Zdarzenie bez subskrybentów jest dostarczone od razu.** Zdarzenie, na które nikt nie czeka,
 * nie może wracać w nieskończoność i zatykać obiegu — a takich będzie większość, dopóki zadanie 25
 * nie dowiezie kompletu subskrypcji.
 *
 * **Błąd jednego subskrybenta nie przerywa pozostałych**, ale całe zdarzenie zostaje
 * **niedostarczone** i wróci w kolejnym obiegu. Konsekwencja: pozostali subskrybenci dostaną je
 * po raz drugi — czyli idempotencja nie jest zaleceniem, tylko warunkiem poprawności.
 */
export async function obiegZdarzen(): Promise<WynikObiegu> {
  const rozwiaz = rozwiazSubskrybentow;
  if (!rozwiaz) throw new Error("Brak rezolwera subskrybentów — korzeń kompozycji go nie wstrzyknął");

  let przetworzone = 0;
  let bledy = 0;

  const dostarczoneIle = await przetworzPartie(async (zdarzenia) => {
    const dostarczone: string[] = [];
    for (const zdarzenie of zdarzenia) {
      przetworzone += 1;
      const subskrybenci = await rozwiaz(zdarzenie);
      let bezBledu = true;

      for (const s of subskrybenci) {
        try {
          await s.handle(zdarzenie);
        } catch (err) {
          bezBledu = false;
          bledy += 1;
          reportServerError(err, {
            scope: "events.dispatch",
            subscriber: s.id,
            eventId: zdarzenie.id,
            eventType: zdarzenie.type,
          });
        }
      }

      if (bezBledu) dostarczone.push(zdarzenie.id);
    }
    return { dostarczone };
  });

  return { przetworzone, dostarczone: dostarczoneIle, bledy };
}
