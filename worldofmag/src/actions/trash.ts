"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { TRASH_RETENTION_DAYS } from "@/platform/trash/trash";
import { SUFIT_LISTY } from "@/platform/pagination";
import { przywrocZMigawki } from "@/lib/trash/przywracanie";

export type TrashItemDTO = {
  id: string;
  module: string;
  entityId: string;
  title: string;
  deletedAt: string;
};

/**
 * 117: kosz użytkownika pokazuje wyłącznie wpisy `active`. Opróżnienie, retencja i przywrócenie
 * tylko OZNACZAJĄ wiersz (`emptied`/`expired`/`restored`) — twardego DELETE nie ma (nieusuwalność
 * zasobów, decyzja właściciela; wyjątek: RODO). Wpisy nie-`active` przywraca admin w /admin/kosz.
 */
export async function getTrash(): Promise<{ items: TrashItemDTO[]; retentionDays: number }> {
  const user = await requireAuth();
  // Wygaszenie przeterminowanych przy każdym wejściu (free-tier: bez crona).
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
  await prisma.trashItem.updateMany({
    where: { userId: user.id, status: "active", deletedAt: { lt: cutoff } },
    data: { status: "expired", resolvedAt: new Date() },
  });

  const rows = await prisma.trashItem.findMany({
    take: SUFIT_LISTY,
    where: { userId: user.id, status: "active" },
    orderBy: { deletedAt: "desc" },
  });
  return {
    items: rows.map((r) => ({
      id: r.id, module: r.module, entityId: r.entityId, title: r.title, deletedAt: r.deletedAt.toISOString(),
    })),
    retentionDays: TRASH_RETENTION_DAYS,
  };
}

export async function restoreTrashItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id || item.status !== "active") throw new Error("Pozycja kosza nie istnieje");

  await przywrocZMigawki(item);

  await prisma.trashItem.update({ where: { id }, data: { status: "restored", resolvedAt: new Date() } });
  revalidatePath("/trash");
  revalidatePath("/notes");
  revalidatePath("/tasks");
  revalidatePath("/pogoda/pomysly");
  revalidatePath("/youtube/kanaly");
  revalidatePath("/rosliny");
  revalidatePath("/contacts");
  revalidatePath("/habits");
}

export async function purgeTrashItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) return;
  // 117: „usuń z kosza" = oznaczenie, nie DELETE — admin nadal może przywrócić.
  await prisma.trashItem.update({ where: { id }, data: { status: "emptied", resolvedAt: new Date() } });
  revalidatePath("/trash");
}

export async function emptyTrash(): Promise<void> {
  const user = await requireAuth();
  await prisma.trashItem.updateMany({
    where: { userId: user.id, status: "active" },
    data: { status: "emptied", resolvedAt: new Date() },
  });
  revalidatePath("/trash");
}
