"use server";

/**
 * 117: PANEL PRZYWRACANIA ADMINA (`/admin/kosz`) — druga droga do wpisów kosza.
 *
 * Nieusuwalność zasobów: opróżnienie kosza i retencja tylko oznaczają wiersz `TrashItem`
 * (`emptied`/`expired`), więc admin widzi WSZYSTKIE wpisy — także te, których użytkownik już
 * nie zobaczy — i może przywrócić zasób właścicielowi. Przywrócenie idzie przez ten sam
 * dispatch co `/trash` (`przywrocZMigawki`), a każda taka operacja ląduje w audycie (C-25).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { logAudit } from "@/platform/audit/audit";
import { przywrocZMigawki } from "@/lib/trash/przywracanie";
import { zapytanieKursorowe, stronaZWierszy } from "@/platform/pagination";
import type { TrashStatus } from "@/platform/trash/trash";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  return session;
}

export type AdminTrashItemDTO = {
  id: string;
  module: string;
  entityId: string;
  title: string;
  status: string;
  deletedAt: string;
  resolvedAt: string | null;
  ownerEmail: string;
};

export type AdminTrashPage = {
  items: AdminTrashItemDTO[];
  nextCursor: string | null;
};

export async function getAdminTrash(params: {
  kursor?: string | null;
  status?: TrashStatus | "all";
  modul?: string | null;
  szukaj?: string | null;
} = {}): Promise<AdminTrashPage> {
  await requireAdmin();

  const szukaj = params.szukaj?.trim();
  const rows = await prisma.trashItem.findMany({
    ...zapytanieKursorowe({ kursor: params.kursor }),
    where: {
      ...(params.status && params.status !== "all" && { status: params.status }),
      ...(params.modul && { module: params.modul }),
      ...(szukaj && {
        OR: [
          { title: { contains: szukaj, mode: "insensitive" } },
          { user: { email: { contains: szukaj, mode: "insensitive" } } },
        ],
      }),
    },
    orderBy: { deletedAt: "desc" },
    include: { user: { select: { email: true } } },
  });

  const strona = stronaZWierszy(rows);
  return {
    items: strona.pozycje.map((r) => ({
      id: r.id,
      module: r.module,
      entityId: r.entityId,
      title: r.title,
      status: r.status,
      deletedAt: r.deletedAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      ownerEmail: r.user?.email ?? "(konto usunięte)",
    })),
    nextCursor: strona.nastepnyKursor,
  };
}

/** Przywraca zasób WŁAŚCICIELOWI wpisu (nie adminowi) i odnotowuje operację w audycie. */
export async function adminRestoreTrashItem(id: string): Promise<void> {
  await requireAdmin();
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item) throw new Error("Pozycja kosza nie istnieje");
  if (item.status === "restored") throw new Error("Ta pozycja została już przywrócona");

  await przywrocZMigawki(item);
  await prisma.trashItem.update({ where: { id }, data: { status: "restored", resolvedAt: new Date() } });

  await logAudit(
    "admin",
    "trash.restore",
    item.entityId,
    `Przywrócono z kosza „${item.title}” (moduł ${item.module}, wpis ${item.id}, poprzedni status ${item.status})`,
  );
  revalidatePath("/admin/kosz");
  revalidatePath("/trash");
}
