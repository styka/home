/**
 * 071 (zadanie 22, rozdz. 9.4.3) — PROTOKÓŁ SUBSKRYPCJI ZDARZEŃ.
 *
 * Moduł deklaruje, **na co reaguje** i **co robi**; platforma nie zna listy subskrybentów i dostaje
 * ją parametrem (C-36).
 */

import type { DomainEventType, DomainEventModule } from "./types";

/** Zdarzenie tak, jak widzi je subskrybent. */
export interface DomainEventRecord {
  id: string;
  workspaceId: string;
  module: DomainEventModule;
  type: DomainEventType;
  payload: unknown;
  /** Sprawca. `null` przy zdarzeniach systemowych. */
  actorId: string | null;
  createdAt: Date;
}

/**
 * Reakcja modułu na zdarzenie.
 *
 * **`handle` MUSI wytrzymać dwukrotne wywołanie tym samym zdarzeniem.** Dostarczenie jest
 * „co najmniej raz" (rozdz. 9.4.4) i to jest wybór świadomy: okna między wykonaniem reakcji
 * a oznaczeniem zdarzenia jako dostarczone nie da się zamknąć — można je tylko uczynić
 * nieszkodliwym. Najprościej kluczem idempotencji wyprowadzonym z `event.id`, który jest **stabilny
 * między ponowieniami** (powstaje przy zapisie zdarzenia, nie przy publikacji).
 *
 * Wymóg jest egzekwowany bramką `npm run check:subscribers`, nie tym komentarzem.
 */
export interface EventSubscriber {
  /** Stabilny identyfikator — trafia do manifestu i do logów. */
  id: string;
  on: DomainEventType[];
  handle(event: DomainEventRecord): Promise<void>;
}

/** Wkład modułu: `src/modules/<x>/events.ts` eksportuje to domyślnie. */
export interface EventContribution {
  subscribers: EventSubscriber[];
}
