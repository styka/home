/**
 * 071 (zadanie 22) — POBIERANIE NIEDOSTARCZONYCH ZDARZEŃ.
 *
 * Wzorzec z `platform/jobs/queue.ts`: `FOR UPDATE SKIP LOCKED`, żeby N instancji nie wzięło tego
 * samego wiersza. Produkcja i środowisko testowe potrafią mieć więcej niż jedną instancję, więc
 * to nie jest przygotowanie na przyszłość, tylko wymóg dzisiejszy.
 *
 * **KIEDY OZNACZAMY DOSTARCZENIE — to jest właściwa decyzja tego pliku.** „Wykonaj subskrybenta"
 * i „oznacz dostarczone" nie mogą być atomowe, bo subskrybent pisze do bazy własną transakcją.
 * Trzeba wybrać, po której stronie leży okno awarii:
 *
 * | Kiedy | Awaria w oknie daje | |
 * |---|---|---|
 * | przy pobraniu | zdarzenie **pominięte**, reakcja nigdy nie nastąpi | ✗ gubi po cichu |
 * | **po sukcesie** | zdarzenie **ponowione**, reakcja wykona się dwa razy | ✓ „co najmniej raz" |
 *
 * Rozdz. 9.4.4 wybiera „co najmniej raz" świadomie. Ceną jest wymóg idempotencji subskrybenta —
 * egzekwowany bramką, nie zaleceniem.
 */

import { prisma } from "@/platform/db/prisma";
import type { DomainEventRecord } from "./subscriber";

/** Ile zdarzeń bierzemy na jeden obieg. Partia ogranicza czas trzymania blokad wierszy. */
export const ROZMIAR_PARTII = 20;

type Wiersz = {
  id: string;
  workspaceId: string;
  module: string;
  type: string;
  payload: unknown;
  actorId: string | null;
  createdAt: Date;
};

/**
 * Otwiera transakcję, rezerwuje partię niedostarczonych zdarzeń i przekazuje je `praca`.
 * Zdarzenia, dla których `praca` **nie rzuciła**, dostają `deliveredAt` w tej samej transakcji.
 *
 * Rezerwacja nie potrzebuje osobnej kolumny „w trakcie": blokada wiersza trzyma się do końca
 * transakcji, więc drugi worker tych wierszy po prostu nie zobaczy (`SKIP LOCKED`).
 */
export async function przetworzPartie(
  praca: (zdarzenia: DomainEventRecord[]) => Promise<{ dostarczone: string[] }>
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const wiersze = await tx.$queryRawUnsafe<Wiersz[]>(
      `SELECT "id", "workspaceId", "module", "type", "payload", "actorId", "createdAt"
       FROM "DomainEvent"
       WHERE "deliveredAt" IS NULL
       ORDER BY "createdAt" ASC
       FOR UPDATE SKIP LOCKED
       LIMIT ${ROZMIAR_PARTII}`
    );
    if (wiersze.length === 0) return 0;

    const zdarzenia = wiersze as unknown as DomainEventRecord[];
    const { dostarczone } = await praca(zdarzenia);

    if (dostarczone.length > 0) {
      await tx.domainEvent.updateMany({
        where: { id: { in: dostarczone } },
        data: { deliveredAt: new Date() },
      });
    }
    return dostarczone.length;
  });
}

/** Ile zdarzeń czeka na dostarczenie — do diagnostyki i testów. */
export async function ileNiedostarczonych(): Promise<number> {
  return prisma.domainEvent.count({ where: { deliveredAt: null } });
}
