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
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  await prisma.trashItem.deleteMany({ where: { userId, deletedAt: { lt: cutoff } } });
}

export const TRASH_RETENTION_DAYS = RETENTION_DAYS;
