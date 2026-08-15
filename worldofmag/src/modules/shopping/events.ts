/**
 * 071 (zadanie 22) — REAKCJE ZAKUPÓW NA ZDARZENIA DOMENOWE.
 *
 * Pierwszy prawdziwy subskrybent w Omnii (C-35: mechanizm dowozimy razem z konsumentem).
 */

import { notifyUser } from "@/lib/notify";
import { prisma } from "@/platform/db/prisma";
import type { EventContribution, EventSubscriber, DomainEventRecord } from "@/platform/events/subscriber";

/**
 * Zakupy zakończone → **pozostali** członkowie przestrzeni dostają powiadomienie.
 *
 * To jest pierwsze użycie pola `actorId`, o które chodzi w rozdz. 9.4.1: przy zasobie
 * współdzielonym „kto to zrobił" jest pytaniem, które padnie. Sprawca **nie** dostaje
 * powiadomienia o własnym kliknięciu, a w przestrzeni osobistej nie ma nikogo innego — więc
 * użytkownik pracujący sam nie zobaczy żadnej zmiany.
 *
 * **IDEMPOTENCJA — `klucz-unikalny`.** `notifyUser` robi `upsert` po `@@unique([userId, dedupeKey])`,
 * a klucz wyprowadzamy z **`event.id`**, który jest stabilny między ponowieniami (powstaje przy
 * zapisie zdarzenia, nie przy publikacji). Drugie dostarczenie tego samego zdarzenia trafia w ten
 * sam wiersz i nic nie zmienia — a dostarczenie jest „co najmniej raz" (rozdz. 9.4.4), więc drugie
 * dostarczenie **nastąpi**.
 */
const zakupyZakonczone: EventSubscriber = {
  id: "shopping.powiadom-o-zakonczeniu",
  on: ["shopping.list.completed"],
  async handle(event: DomainEventRecord): Promise<void> {
    const ladunek = event.payload as { nazwa?: string; suma?: number } | null;

    const czlonkowie = await prisma.workspaceMember.findMany({
      where: { workspaceId: event.workspaceId, NOT: { userId: event.actorId ?? "" } },
      select: { userId: true },
    });
    if (czlonkowie.length === 0) return;

    const kto = event.actorId
      ? (await prisma.user.findUnique({ where: { id: event.actorId }, select: { name: true } }))?.name
      : null;
    const nazwa = ladunek?.nazwa ?? "listę zakupów";

    for (const c of czlonkowie) {
      await notifyUser({
        userId: c.userId,
        module: "shopping",
        title: kto ? `${kto} zakończył zakupy` : "Zakupy zakończone",
        body: `Zamknięto „${nazwa}".`,
        href: "/shopping",
        // Klucz z ID ZDARZENIA — stąd bierze się idempotencja przy ponowieniu.
        dedupeKey: `zdarzenie-${event.id}`,
      });
    }
  },
};

const wklad: EventContribution = { subscribers: [zakupyZakonczone] };

export default wklad;
