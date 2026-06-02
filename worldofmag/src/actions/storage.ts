"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { categorize } from "@/lib/categorize";
import { trackActivity } from "@/actions/activity";
import { assertListAccess } from "@/actions/lists";
import type { StorageItem, StorageMovement, Item } from "@prisma/client";

export type StorageItemWithMovements = StorageItem & {
  movements: StorageMovement[];
};

async function assertStorageItemAccess(storageItemId: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const item = await prisma.storageItem.findUnique({
    where: { id: storageItemId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!item) throw new Error("Pozycja magazynowa nie istnieje");
  if (item.ownerId === userId) return;
  if (item.ownerTeamId && teamIds.includes(item.ownerTeamId)) return;
  throw new Error("Brak dostępu do tej pozycji");
}

// ─── Read ─────────────────────────────────────────────────────────────────

export async function getStorageItems(teamId?: string): Promise<StorageItemWithMovements[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const ownership = teamId
    ? teamIds.includes(teamId)
      ? [{ ownerTeamId: teamId }]
      : []
    : [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ];

  if (ownership.length === 0) return [];

  return prisma.storageItem.findMany({
    where: { OR: ownership },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: [{ warehouse: "asc" }, { location: "asc" }, { name: "asc" }],
  });
}

/** Pozycje poniżej stanu minimalnego — kandydaci do uzupełnienia. */
export async function getLowStock(): Promise<StorageItemWithMovements[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const items = await prisma.storageItem.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
      minQuantity: { not: null },
    },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 20 } },
    orderBy: [{ warehouse: "asc" }, { name: "asc" }],
  });

  return items.filter((i) => (i.quantity ?? 0) < (i.minQuantity ?? 0));
}

// ─── Write ────────────────────────────────────────────────────────────────

export interface StorageItemInput {
  name: string;
  sku?: string | null;
  category?: string | null;
  warehouse?: string | null;
  location?: string | null;
  quantity?: number | null;
  unit?: string | null;
  minQuantity?: number | null;
  notes?: string | null;
  teamId?: string | null;
}

export async function addStorageItem(data: StorageItemInput): Promise<StorageItem> {
  const user = await requireAuth();

  if (data.teamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const created = await prisma.storageItem.create({
    data: {
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      category: data.category?.trim() || null,
      warehouse: data.warehouse?.trim() || null,
      location: data.location?.trim() || null,
      quantity: data.quantity ?? null,
      unit: data.unit?.trim() || null,
      minQuantity: data.minQuantity ?? null,
      notes: data.notes?.trim() || null,
      ownerId: data.teamId ? null : user.id,
      ownerTeamId: data.teamId ?? null,
    },
  });

  void trackActivity("magazynowanie", "add_storage_item", { id: created.id, name: created.name });
  revalidatePath("/magazynowanie");
  revalidatePath("/");
  return created;
}

export async function updateStorageItem(
  id: string,
  patch: Partial<Omit<StorageItemInput, "teamId">>
): Promise<StorageItem> {
  const user = await requireAuth();
  await assertStorageItemAccess(id, user.id);

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.sku !== undefined) data.sku = patch.sku?.trim() || null;
  if (patch.category !== undefined) data.category = patch.category?.trim() || null;
  if (patch.warehouse !== undefined) data.warehouse = patch.warehouse?.trim() || null;
  if (patch.location !== undefined) data.location = patch.location?.trim() || null;
  if (patch.quantity !== undefined) data.quantity = patch.quantity;
  if (patch.unit !== undefined) data.unit = patch.unit?.trim() || null;
  if (patch.minQuantity !== undefined) data.minQuantity = patch.minQuantity;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;

  const updated = await prisma.storageItem.update({ where: { id }, data });
  revalidatePath("/magazynowanie");
  revalidatePath("/");
  return updated;
}

export async function deleteStorageItem(id: string): Promise<void> {
  const user = await requireAuth();
  await assertStorageItemAccess(id, user.id);
  await prisma.storageItem.delete({ where: { id } });
  revalidatePath("/magazynowanie");
  revalidatePath("/");
}

/**
 * Ruch magazynowy ze znakiem: +przyjęcie / −wydanie. Aktualizuje stan i zapisuje
 * wpis w dzienniku (obsługa zaawansowana: przyjęcia, wydania, obieg kurierski).
 */
export async function adjustStorageQuantity(
  id: string,
  delta: number,
  reason?: string,
  note?: string
): Promise<StorageItem> {
  const user = await requireAuth();
  await assertStorageItemAccess(id, user.id);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Nieprawidłowa zmiana ilości");

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.storageItem.findUnique({ where: { id }, select: { quantity: true } });
    if (!existing) throw new Error("Pozycja nie istnieje");
    const next = Math.max(0, (existing.quantity ?? 0) + delta);
    const item = await tx.storageItem.update({ where: { id }, data: { quantity: next } });
    await tx.storageMovement.create({
      data: {
        itemId: id,
        delta,
        reason: reason ?? (delta > 0 ? "przyjęcie" : "wydanie"),
        note: note?.trim() || null,
      },
    });
    return item;
  });

  revalidatePath("/magazynowanie");
  revalidatePath("/");
  return updated;
}

/** Tryb spisu: ustawia ilości wprost i loguje korekty (reason "spis"). */
export async function bulkSetStorageQuantities(
  updates: Array<{ id: string; quantity: number | null }>
): Promise<void> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      const item = await tx.storageItem.findUnique({
        where: { id: u.id },
        select: { ownerId: true, ownerTeamId: true, quantity: true },
      });
      if (!item) continue;
      if (item.ownerId !== user.id && (!item.ownerTeamId || !teamIds.includes(item.ownerTeamId))) {
        throw new Error("Brak dostępu do pozycji");
      }
      const before = item.quantity ?? 0;
      const after = u.quantity ?? 0;
      await tx.storageItem.update({ where: { id: u.id }, data: { quantity: u.quantity } });
      if (after !== before) {
        await tx.storageMovement.create({
          data: { itemId: u.id, delta: after - before, reason: "spis" },
        });
      }
    }
  });

  revalidatePath("/magazynowanie");
  revalidatePath("/");
}

/** Masowe dodanie pozycji (po skanie zdjęcia). Wszystkie trafiają do jednego magazynu/lokalizacji. */
export async function bulkAddStorageItems(
  items: Array<{ name: string; quantity?: number | null; unit?: string | null; category?: string | null; notes?: string | null }>,
  target?: { warehouse?: string | null; location?: string | null; teamId?: string | null }
): Promise<number> {
  const user = await requireAuth();

  if (target?.teamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(target.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const clean = items
    .map((i) => ({ ...i, name: i.name?.trim() }))
    .filter((i) => i.name);
  if (clean.length === 0) return 0;

  await prisma.storageItem.createMany({
    data: clean.map((i) => ({
      name: i.name,
      quantity: i.quantity ?? null,
      unit: i.unit?.trim() || null,
      category: i.category?.trim() || null,
      notes: i.notes?.trim() || null,
      warehouse: target?.warehouse?.trim() || null,
      location: target?.location?.trim() || null,
      ownerId: target?.teamId ? null : user.id,
      ownerTeamId: target?.teamId ?? null,
    })),
  });

  void trackActivity("magazynowanie", "scan_import", { count: clean.length });
  revalidatePath("/magazynowanie");
  revalidatePath("/");
  return clean.length;
}

// ─── Integracja z zakupami (uzupełnianie) ───────────────────────────────────

/** Dodaje braki (pozycje poniżej minimum) jako pozycje na wskazanej liście zakupów. */
export async function addLowStockToShoppingList(listId: string): Promise<{ addedItems: Item[] }> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);

  const candidates = await getLowStock();
  const added: Item[] = [];

  for (const c of candidates) {
    const deficit =
      c.minQuantity != null
        ? Math.max(c.minQuantity - (c.quantity ?? 0), c.minQuantity)
        : null;
    const created = await prisma.item.create({
      data: {
        listId,
        name: c.name,
        quantity: deficit ?? null,
        unit: c.unit ?? null,
        category: c.category ?? categorize(c.name),
      },
    });
    added.push(created);
  }

  void trackActivity("magazynowanie", "replenish", { listId, count: added.length });
  revalidatePath(`/shopping/${listId}`);
  return { addedItems: added };
}
