"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth, getAccessibleTeamIds, ownedWhereAsync } from "@/platform/auth/serverUtils";
import type { ShoppingList, ShoppingListWithItems } from "@/types";
import { emitDomainEvent, workspaceIdDlaZdarzenia } from "@/platform/events/emit";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

export interface ListSummary {
  id: string;
  name: string;
  pendingCount: number;
  totalCount: number;
  teamName: string | null;
  archived?: boolean;
}

export async function getListSummaries(includeArchived = false): Promise<ListSummary[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "shopping");

  const lists = await prisma.shoppingList.findMany({
    where: {
      archived: includeArchived,
      ...(await ownedWhereAsync(user.id)),
    },
    include: { workspace: { select: { team: { select: { id: true, name: true } } } } },
    orderBy: includeArchived ? { archivedAt: "desc" } : { createdAt: "asc" },
  });

  return Promise.all(
    lists.map(async (list) => {
      const [pendingCount, totalCount] = await Promise.all([
        prisma.item.count({ where: { listId: list.id, status: "NEEDED" } }),
        prisma.item.count({ where: { listId: list.id } }),
      ]);
      return {
        id: list.id,
        name: list.name,
        pendingCount,
        totalCount,
        teamName: list.workspace?.team?.name ?? null,
        archived: list.archived,
      };
    })
  );
}

/**
 * Returns all lists visible to the current user:
 * - Lists they personally own
 * - Lists owned by any team they belong to
 */
export async function getLists(): Promise<ShoppingList[]> {
  const user = await requireAuth();

  const teamIds = await getAccessibleTeamIds(user.id, "shopping");

  return prisma.shoppingList.findMany({
    where: {
      archived: false,
      ...(await ownedWhereAsync(user.id)),
    },
    include: { workspace: { select: { team: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "asc" },
  }) as unknown as Promise<ShoppingList[]>;
}

/**
 * 009-shopping-offline-sync: wszystkie AKTYWNE listy użytkownika (user + team) wraz z pozycjami —
 * do zbudowania lokalnego snapshotu na potrzeby pracy offline. Read-only (bez revalidatePath).
 * Pozycje w tej samej kolejności co strona listy (ręczny order → priority → createdAt).
 */
export async function getActiveListsForOffline(): Promise<ShoppingListWithItems[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "shopping");

  const lists = await prisma.shoppingList.findMany({
    where: {
      archived: false,
      ...(await ownedWhereAsync(user.id)),
    },
    include: {
      workspace: { select: { team: { select: { id: true, name: true } } } },
      items: { orderBy: [{ order: "asc" }, { priority: "desc" }, { createdAt: "asc" }] },
    },
    orderBy: { createdAt: "asc" },
  });

  return lists as unknown as ShoppingListWithItems[];
}

export async function getArchivedLists(): Promise<ShoppingList[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "shopping");

  return prisma.shoppingList.findMany({
    where: {
      archived: true,
      ...(await ownedWhereAsync(user.id)),
    },
    include: { workspace: { select: { team: { select: { id: true, name: true } } } } },
    orderBy: { archivedAt: "desc" },
  }) as unknown as Promise<ShoppingList[]>;
}

export async function createList(name: string, ownerTeamId?: string): Promise<ShoppingList> {
  const user = await requireAuth();

  // If assigning to a team, verify membership
  if (ownerTeamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: ownerTeamId, userId: user.id } },
    });
    if (!membership) throw new Error("Not a member of that team");
  }

  const list = await prisma.shoppingList.create({
    data: {
      name: name.trim(),
      ...(await wlasnoscDoZapisu(user.id, ownerTeamId)),
    },
  });
  revalidatePath("/shopping");
  return list as unknown as ShoppingList;
}

export async function renameList(id: string, name: string): Promise<ShoppingList> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  const list = await prisma.shoppingList.update({
    where: { id },
    data: { name: name.trim() },
  });
  revalidatePath("/shopping");
  revalidatePath(`/shopping/${id}`);
  return list as unknown as ShoppingList;
}

export async function deleteList(id: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  await prisma.shoppingList.delete({ where: { id } });
  revalidatePath("/shopping");
}

export async function archiveList(id: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  await prisma.shoppingList.update({
    where: { id },
    data: { archived: true, archivedAt: new Date() },
  });
  revalidatePath("/shopping");
  revalidatePath(`/shopping/${id}`);
}

/**
 * S6: zakończenie zakupów — archiwizuje listę i opcjonalnie księguje sumę kupionych
 * pozycji (cena × ilość dla statusu DONE) jako wydatek w Portfelu (silnik W4).
 */
export async function completeShopping(
  id: string,
  opts?: { bookToPortfel?: boolean }
): Promise<{ total: number; zlecono: boolean }> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);

  const list = await prisma.shoppingList.findUnique({
    where: { id },
    include: { items: { select: { status: true, price: true, quantity: true } } },
  });
  if (!list) throw new Error("Lista nie istnieje");

  const total = list.items
    .filter((it) => it.status === "DONE" && it.price != null)
    .reduce((s, it) => s + (it.price as number) * (it.quantity && it.quantity > 0 ? it.quantity : 1), 0);

  // 070 (zadanie 21): archiwizacja listy i ZDARZENIE w jednej transakcji (rozdz. 9.4.2).
  //
  // 073 (zadanie 25, rozdz. 9.5): księgowanie w Portfelu ZNIKŁO STĄD. Zakupy nie importują już
  // `bookAutoExpense` ani niczego innego z Portfela — ogłaszają tylko, że lista została zamknięta,
  // i niosą w ładunku ŻYCZENIE użytkownika (`ksiegowac`). Czy z tego życzenia wyniknie wydatek,
  // rozstrzyga subskrybent po stronie Portfela (`modules/portfel/events.ts`), bo to jego reguła.
  //
  // Zasada „tylko prywatne listy" też się tam przeniosła — dlatego zniknął odczyt `list.ownerId`.
  const zlecono = Boolean(opts?.bookToPortfel) && total > 0;
  const przestrzen = await workspaceIdDlaZdarzenia(list.workspaceId, user.id);
  // 077 (U-2): brak przestrzeni to BŁĄD, nie powód do pominięcia zdarzenia. Dawne `if (przestrzen)`
  // przepuszczało mutację bez emisji, więc reakcja Portfela po prostu nie następowała — bez
  // wyjątku, bez logu, a akcja i tak zwracała `zlecono: true`. Użytkownik dostawał potwierdzenie
  // księgowania, którego nikt nie wykonał. Po zaostrzeniu z 0235 ta gałąź jest nieosiągalna dla
  // list zakupów — i właśnie dlatego ma być asercją niezmiennika, a nie cichym `if`.
  if (!przestrzen) {
    throw new Error(`Lista ${id} nie ma przestrzeni — nie mogę wyemitować zdarzenia zakończenia zakupów`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.shoppingList.update({ where: { id }, data: { archived: true, archivedAt: new Date() } });
    {
      await emitDomainEvent(tx, {
        workspaceId: przestrzen,
        module: "shopping",
        type: "shopping.list.completed",
        actorId: user.id,
        payload: { listId: id, nazwa: list.name, suma: total, pozycji: list.items.length, ksiegowac: zlecono },
      });
    }
  });

  revalidatePath("/shopping");
  revalidatePath(`/shopping/${id}`);
  revalidatePath("/portfel");
  // `zlecono`, nie `booked` — i to nie jest kosmetyka nazwy. Dawne `booked` też nie znaczyło
  // „pieniądze zaksięgowane": ustawiało się na `true` zaraz po wywołaniu `bookAutoExpense`, które
  // po cichu nic nie robi, gdy użytkownik nie ma skonfigurowanego konta auto-wydatków. Nowa nazwa
  // mówi to, co pole zawsze znaczyło — że zlecenie poszło.
  return { total, zlecono };
}

export async function unarchiveList(id: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(id, user.id);
  await prisma.shoppingList.update({
    where: { id },
    data: { archived: false, archivedAt: null },
  });
  revalidatePath("/shopping");
}

/**
 * Throws if the user doesn't own the list (directly or via a team).
 */
export async function assertListAccess(listId: string, userId: string): Promise<void> {
  // 064: dostęp rozstrzyga PLATFORMA na podstawie deklaracji `shopping.list`. Guard został cienką
  // nakładką tłumaczącą dawne API na operację z deklaracji i ZACHOWUJE dawne komunikaty —
  // rozróżnienie „nie ma listy" od „brak dostępu" niesie informację, której platforma nie daje.
  const { requireModuleAccess } = await import("../lib/sharingGuard");
  const istnieje = await prisma.shoppingList.findUnique({ where: { id: listId }, select: { id: true } });
  if (!istnieje) throw new Error("List not found");
  try {
    await requireModuleAccess(userId, { type: "shopping.list", id: listId }, "list.edit");
  } catch {
    throw new Error("Access denied");
  }
}
