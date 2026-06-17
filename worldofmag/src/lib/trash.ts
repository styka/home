// H5: kosz / soft-delete. Helper server-side (NIE "use server") wołany przez akcje usuwania
// (notes.ts, tasks.ts…), nie eksponowany do klienta. Zapisuje migawkę encji przed twardym
// usunięciem, by dało się ją przywrócić.

import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;

export type TrashModule = "notes" | "tasks";

/** Zapisuje migawkę usuwanej encji do kosza i przy okazji czyści wpisy starsze niż 30 dni. */
export async function recordTrash(
  userId: string,
  data: { module: TrashModule; entityId: string; title: string; payload: unknown },
): Promise<void> {
  await prisma.trashItem.create({
    data: {
      userId,
      module: data.module,
      entityId: data.entityId,
      title: data.title.slice(0, 200) || "(bez tytułu)",
      payload: JSON.stringify(data.payload),
    },
  });
  // Sprzątanie: usuń przeterminowane wpisy tego użytkownika (free-tier: bez crona).
  await prisma.trashItem.deleteMany({ where: { userId, deletedAt: { lt: trashCutoff() } } });
}

export const TRASH_RETENTION_DAYS = RETENTION_DAYS;

/**
 * Z-059: data graniczna retencji kosza — wpisy usunięte przed nią są do twardego
 * usunięcia. Czysta funkcja (testowalna), wspólna dla inline-cleanup i globalnego sweepu.
 */
export function trashCutoff(now: Date = new Date(), retentionDays: number = RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * 86_400_000);
}

/**
 * Z-059: globalne czyszczenie przeterminowanego kosza (WSZYSCY użytkownicy).
 * Inline-cleanup w `recordTrash` dotyka tylko aktywnego usera — konta nieaktywne
 * nigdy nie zwolniłyby swoich wpisów. Wołane z zewnętrznego wyzwalacza
 * (`/api/cron/retention`), bo free tier nie ma natywnego crona. Zwraca liczbę usuniętych.
 */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<number> {
  const res = await prisma.trashItem.deleteMany({ where: { deletedAt: { lt: trashCutoff(now) } } });
  return res.count;
}
