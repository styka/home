"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { categorize } from "@/lib/categorize";
import { trackActivity } from "@/actions/activity";
import { assertListAccess } from "@/actions/lists";
import type {
  StorageItem,
  StorageMovement,
  StorageSupplier,
  StorageBatch,
  StorageDocument,
  StorageDocumentLine,
  StoragePurchaseOrder,
  StoragePurchaseOrderLine,
  Item,
} from "@prisma/client";

export type StorageItemWithMovements = StorageItem & {
  movements: StorageMovement[];
};

export type StorageItemDetail = StorageItem & {
  movements: StorageMovement[];
  batches: StorageBatch[];
  supplier: StorageSupplier | null;
};

export type StorageMode = "home" | "pro";

/** Buduje warunek własności (user OR teamy) dla dowolnego modelu magazynowego. */
function ownershipOr(userId: string, teamIds: string[]) {
  return [
    { ownerId: userId },
    ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
  ];
}

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
  barcode?: string | null;
  category?: string | null;
  warehouse?: string | null;
  location?: string | null;
  quantity?: number | null;
  unit?: string | null;
  minQuantity?: number | null;
  unitPrice?: number | null;
  photoUrl?: string | null;
  expiresAt?: Date | string | null;
  warrantyUntil?: Date | string | null;
  supplierId?: string | null;
  notes?: string | null;
  teamId?: string | null;
}

/** Normalizuje wartość daty z formularza (string/Date/null) do Date|null. */
function toDate(v: Date | string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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
      barcode: data.barcode?.trim() || null,
      category: data.category?.trim() || null,
      warehouse: data.warehouse?.trim() || null,
      location: data.location?.trim() || null,
      quantity: data.quantity ?? null,
      unit: data.unit?.trim() || null,
      minQuantity: data.minQuantity ?? null,
      unitPrice: data.unitPrice ?? null,
      photoUrl: data.photoUrl || null,
      expiresAt: toDate(data.expiresAt) ?? null,
      warrantyUntil: toDate(data.warrantyUntil) ?? null,
      supplierId: data.supplierId || null,
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
  if (patch.barcode !== undefined) data.barcode = patch.barcode?.trim() || null;
  if (patch.category !== undefined) data.category = patch.category?.trim() || null;
  if (patch.warehouse !== undefined) data.warehouse = patch.warehouse?.trim() || null;
  if (patch.location !== undefined) data.location = patch.location?.trim() || null;
  if (patch.quantity !== undefined) data.quantity = patch.quantity;
  if (patch.unit !== undefined) data.unit = patch.unit?.trim() || null;
  if (patch.minQuantity !== undefined) data.minQuantity = patch.minQuantity;
  if (patch.unitPrice !== undefined) data.unitPrice = patch.unitPrice;
  if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl || null;
  if (patch.expiresAt !== undefined) data.expiresAt = toDate(patch.expiresAt);
  if (patch.warrantyUntil !== undefined) data.warrantyUntil = toDate(patch.warrantyUntil);
  if (patch.supplierId !== undefined) data.supplierId = patch.supplierId || null;
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
    // Z-073: jeden odczyt pozycji zamiast findUnique per wiersz (N+1) — przy spisie
    // całego magazynu to dziesiątki/setki zapytań mniej.
    const items = await tx.storageItem.findMany({
      where: { id: { in: updates.map((u) => u.id) } },
      select: { id: true, ownerId: true, ownerTeamId: true, quantity: true },
    });
    const byId = new Map(items.map((it) => [it.id, it]));

    for (const u of updates) {
      const item = byId.get(u.id);
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

// ─── Ustawienia / tryb Dom↔Pro ──────────────────────────────────────────────

export interface StorageSettingsView {
  mode: StorageMode;
  currency: string;
}

export async function getStorageSettings(): Promise<StorageSettingsView> {
  const user = await requireAuth();
  const s = await prisma.storageSettings.findUnique({ where: { userId: user.id } });
  return { mode: (s?.mode as StorageMode) || "home", currency: s?.currency || "PLN" };
}

export async function setStorageMode(mode: StorageMode): Promise<void> {
  const user = await requireAuth();
  if (mode !== "home" && mode !== "pro") throw new Error("Nieprawidłowy tryb");
  await prisma.storageSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, mode },
    update: { mode },
  });
  revalidatePath("/magazynowanie");
}

export async function setStorageCurrency(currency: string): Promise<void> {
  const user = await requireAuth();
  const cur = currency.trim().toUpperCase().slice(0, 3) || "PLN";
  await prisma.storageSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, currency: cur },
    update: { currency: cur },
  });
  revalidatePath("/magazynowanie");
}

// ─── Szczegóły pozycji ──────────────────────────────────────────────────────

export async function getStorageItem(id: string): Promise<StorageItemDetail | null> {
  const user = await requireAuth();
  await assertStorageItemAccess(id, user.id);
  return prisma.storageItem.findUnique({
    where: { id },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 100 },
      batches: { orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }] },
      supplier: true,
    },
  });
}

/** Znajduje pozycję po kodzie (barcode → sku → dokładna nazwa). Do skanowania we/wy. */
export async function findStorageItemByCode(code: string): Promise<StorageItem | null> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const c = code.trim();
  if (!c) return null;
  return prisma.storageItem.findFirst({
    where: {
      OR: ownershipOr(user.id, teamIds),
      AND: {
        OR: [{ barcode: c }, { sku: c }, { name: { equals: c, mode: "insensitive" } }],
      },
    },
  });
}

// ─── Przesunięcie międzymagazynowe ──────────────────────────────────────────

/**
 * Przenosi ilość pozycji do innego magazynu/lokalizacji. Jeśli w docelowym miejscu
 * istnieje już pozycja o tej samej nazwie — scala (dodaje ilość), w przeciwnym razie
 * tworzy nową pozycję. Loguje ruchy „przesunięcie" po obu stronach.
 */
export async function transferStock(
  id: string,
  toWarehouse: string | null,
  toLocation: string | null,
  qty: number
): Promise<void> {
  const user = await requireAuth();
  await assertStorageItemAccess(id, user.id);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Nieprawidłowa ilość");

  await prisma.$transaction(async (tx) => {
    const src = await tx.storageItem.findUnique({ where: { id } });
    if (!src) throw new Error("Pozycja nie istnieje");
    const moved = Math.min(qty, src.quantity ?? 0);
    if (moved <= 0) throw new Error("Brak wystarczającej ilości");

    await tx.storageItem.update({
      where: { id },
      data: { quantity: (src.quantity ?? 0) - moved },
    });
    await tx.storageMovement.create({
      data: { itemId: id, delta: -moved, reason: "przesunięcie", note: `→ ${toWarehouse ?? "?"}${toLocation ? " / " + toLocation : ""}` },
    });

    const wh = toWarehouse?.trim() || null;
    const loc = toLocation?.trim() || null;
    const dest = await tx.storageItem.findFirst({
      where: {
        name: src.name,
        warehouse: wh,
        location: loc,
        OR: [{ ownerId: src.ownerId ?? undefined }, { ownerTeamId: src.ownerTeamId ?? undefined }],
        NOT: { id },
      },
    });

    if (dest) {
      await tx.storageItem.update({
        where: { id: dest.id },
        data: { quantity: (dest.quantity ?? 0) + moved },
      });
      await tx.storageMovement.create({
        data: { itemId: dest.id, delta: moved, reason: "przesunięcie", note: `← ${src.warehouse ?? "?"}` },
      });
    } else {
      const created = await tx.storageItem.create({
        data: {
          name: src.name,
          sku: src.sku,
          barcode: src.barcode,
          category: src.category,
          warehouse: wh,
          location: loc,
          quantity: moved,
          unit: src.unit,
          unitPrice: src.unitPrice,
          supplierId: src.supplierId,
          ownerId: src.ownerId,
          ownerTeamId: src.ownerTeamId,
        },
      });
      await tx.storageMovement.create({
        data: { itemId: created.id, delta: moved, reason: "przesunięcie", note: `← ${src.warehouse ?? "?"}` },
      });
    }
  });

  revalidatePath("/magazynowanie");
}

// ─── Dostawcy ───────────────────────────────────────────────────────────────

export interface SupplierInput {
  name: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  teamId?: string | null;
}

export async function getSuppliers(): Promise<StorageSupplier[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  return prisma.storageSupplier.findMany({
    where: { OR: ownershipOr(user.id, teamIds) },
    orderBy: { name: "asc" },
  });
}

async function assertSupplierAccess(id: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const s = await prisma.storageSupplier.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  if (!s) throw new Error("Dostawca nie istnieje");
  if (s.ownerId === userId) return;
  if (s.ownerTeamId && teamIds.includes(s.ownerTeamId)) return;
  throw new Error("Brak dostępu do dostawcy");
}

export async function addSupplier(data: SupplierInput): Promise<StorageSupplier> {
  const user = await requireAuth();
  if (data.teamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }
  const created = await prisma.storageSupplier.create({
    data: {
      name: data.name.trim(),
      contact: data.contact?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
      ownerId: data.teamId ? null : user.id,
      ownerTeamId: data.teamId ?? null,
    },
  });
  revalidatePath("/magazynowanie/dostawcy");
  return created;
}

export async function updateSupplier(id: string, patch: Partial<Omit<SupplierInput, "teamId">>): Promise<void> {
  const user = await requireAuth();
  await assertSupplierAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.contact !== undefined) data.contact = patch.contact?.trim() || null;
  if (patch.email !== undefined) data.email = patch.email?.trim() || null;
  if (patch.phone !== undefined) data.phone = patch.phone?.trim() || null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  await prisma.storageSupplier.update({ where: { id }, data });
  revalidatePath("/magazynowanie/dostawcy");
}

export async function deleteSupplier(id: string): Promise<void> {
  const user = await requireAuth();
  await assertSupplierAccess(id, user.id);
  await prisma.storageSupplier.delete({ where: { id } });
  revalidatePath("/magazynowanie/dostawcy");
}

// ─── Partie / serie (FEFO) ──────────────────────────────────────────────────

export interface BatchInput {
  lotNo?: string | null;
  serialNo?: string | null;
  quantity: number;
  expiresAt?: Date | string | null;
  note?: string | null;
}

/** Synchronizuje quantity pozycji z sumą partii (gdy partie istnieją). */
async function syncQuantityFromBatches(tx: typeof prisma, itemId: string): Promise<void> {
  const batches = await tx.storageBatch.findMany({ where: { itemId }, select: { quantity: true } });
  if (batches.length === 0) return;
  const sum = batches.reduce((a, b) => a + (b.quantity ?? 0), 0);
  await tx.storageItem.update({ where: { id: itemId }, data: { quantity: sum } });
}

export async function addBatch(itemId: string, data: BatchInput): Promise<void> {
  const user = await requireAuth();
  await assertStorageItemAccess(itemId, user.id);
  await prisma.$transaction(async (tx) => {
    await tx.storageBatch.create({
      data: {
        itemId,
        lotNo: data.lotNo?.trim() || null,
        serialNo: data.serialNo?.trim() || null,
        quantity: data.quantity,
        expiresAt: toDate(data.expiresAt) ?? null,
        note: data.note?.trim() || null,
      },
    });
    await syncQuantityFromBatches(tx as unknown as typeof prisma, itemId);
  });
  revalidatePath("/magazynowanie");
}

export async function deleteBatch(batchId: string): Promise<void> {
  const user = await requireAuth();
  const batch = await prisma.storageBatch.findUnique({ where: { id: batchId }, select: { itemId: true } });
  if (!batch) return;
  await assertStorageItemAccess(batch.itemId, user.id);
  await prisma.$transaction(async (tx) => {
    await tx.storageBatch.delete({ where: { id: batchId } });
    await syncQuantityFromBatches(tx as unknown as typeof prisma, batch.itemId);
  });
  revalidatePath("/magazynowanie");
}

/**
 * Wydanie wg FEFO: zdejmuje ilość z partii o najwcześniejszej dacie ważności.
 * Zwraca listę zużytych partii (do podpowiedzi w UI).
 */
export async function issueByFEFO(itemId: string, qty: number, note?: string): Promise<void> {
  const user = await requireAuth();
  await assertStorageItemAccess(itemId, user.id);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Nieprawidłowa ilość");
  await prisma.$transaction(async (tx) => {
    const batches = await tx.storageBatch.findMany({
      where: { itemId, quantity: { gt: 0 } },
      orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }],
    });
    let remaining = qty;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      await tx.storageBatch.update({ where: { id: b.id }, data: { quantity: b.quantity - take } });
      remaining -= take;
    }
    await tx.storageMovement.create({
      data: { itemId, delta: -(qty - Math.max(0, remaining)), reason: "wydanie", note: note?.trim() || "FEFO" },
    });
    await syncQuantityFromBatches(tx as unknown as typeof prisma, itemId);
  });
  revalidatePath("/magazynowanie");
}

// ─── Alerty: wygasające / gwarancje / martwy zapas ──────────────────────────

export interface ExpiringEntry {
  id: string;
  name: string;
  warehouse: string | null;
  location: string | null;
  kind: "ważność" | "gwarancja";
  date: Date;
  daysLeft: number;
}

export async function getExpiringStorage(withinDays = 30): Promise<ExpiringEntry[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const now = new Date();
  const items = await prisma.storageItem.findMany({
    where: {
      OR: ownershipOr(user.id, teamIds),
      AND: { OR: [{ expiresAt: { not: null } }, { warrantyUntil: { not: null } }] },
    },
    select: { id: true, name: true, warehouse: true, location: true, expiresAt: true, warrantyUntil: true },
  });
  const out: ExpiringEntry[] = [];
  const dayMs = 86_400_000;
  for (const i of items) {
    for (const [kind, date] of [["ważność", i.expiresAt], ["gwarancja", i.warrantyUntil]] as const) {
      if (!date) continue;
      const daysLeft = Math.ceil((date.getTime() - now.getTime()) / dayMs);
      if (daysLeft <= withinDays) {
        out.push({ id: i.id, name: i.name, warehouse: i.warehouse, location: i.location, kind, date, daysLeft });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

// ─── Analityka (tryb pro) ───────────────────────────────────────────────────

export interface StorageAnalytics {
  currency: string;
  totalValue: number;
  itemCount: number;
  totalUnits: number;
  lowStockCount: number;
  deadStockCount: number;
  valueByWarehouse: Array<{ warehouse: string; value: number; items: number }>;
  abc: Array<{ id: string; name: string; value: number; cumPct: number; klasa: "A" | "B" | "C" }>;
  deadStock: Array<{ id: string; name: string; quantity: number; lastMove: Date | null; value: number }>;
  movementTrend: Array<{ date: string; in: number; out: number }>;
}

export async function getStorageAnalytics(deadDays = 90): Promise<StorageAnalytics> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const settings = await getStorageSettings();

  const items = await prisma.storageItem.findMany({
    where: { OR: ownershipOr(user.id, teamIds) },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const itemValue = (i: { quantity: number | null; unitPrice: number | null }) =>
    (i.quantity ?? 0) * (i.unitPrice ?? 0);

  const totalValue = items.reduce((a, i) => a + itemValue(i), 0);
  const totalUnits = items.reduce((a, i) => a + (i.quantity ?? 0), 0);
  const lowStockCount = items.filter((i) => i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity).length;

  // Wartość wg magazynu
  const whMap = new Map<string, { value: number; items: number }>();
  for (const i of items) {
    const key = i.warehouse?.trim() || "—";
    const cur = whMap.get(key) ?? { value: 0, items: 0 };
    cur.value += itemValue(i);
    cur.items += 1;
    whMap.set(key, cur);
  }
  const valueByWarehouse = Array.from(whMap.entries())
    .map(([warehouse, v]) => ({ warehouse, ...v }))
    .sort((a, b) => b.value - a.value);

  // ABC (Pareto wg wartości)
  const valued = items
    .map((i) => ({ id: i.id, name: i.name, value: itemValue(i) }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  const sumValued = valued.reduce((a, i) => a + i.value, 0) || 1;
  let cum = 0;
  const abc = valued.map((i) => {
    cum += i.value;
    const cumPct = (cum / sumValued) * 100;
    const klasa: "A" | "B" | "C" = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
    return { ...i, cumPct, klasa };
  });

  // Martwy zapas: brak ruchu od deadDays (lub nigdy), a stan > 0
  const cutoff = Date.now() - deadDays * 86_400_000;
  const deadStock = items
    .filter((i) => (i.quantity ?? 0) > 0)
    .map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity ?? 0,
      lastMove: i.movements[0]?.createdAt ?? null,
      value: itemValue(i),
    }))
    .filter((i) => !i.lastMove || i.lastMove.getTime() < cutoff)
    .sort((a, b) => b.value - a.value);

  // Trend ruchów: ostatnie 14 dni (przyjęcia vs wydania)
  const since = new Date(Date.now() - 14 * 86_400_000);
  const movements = await prisma.storageMovement.findMany({
    where: { item: { OR: ownershipOr(user.id, teamIds) }, createdAt: { gte: since } },
    select: { delta: true, createdAt: true },
  });
  const trendMap = new Map<string, { in: number; out: number }>();
  for (let d = 0; d < 14; d++) {
    const day = new Date(Date.now() - (13 - d) * 86_400_000).toISOString().slice(0, 10);
    trendMap.set(day, { in: 0, out: 0 });
  }
  for (const m of movements) {
    const day = m.createdAt.toISOString().slice(0, 10);
    const cur = trendMap.get(day);
    if (!cur) continue;
    if (m.delta >= 0) cur.in += m.delta;
    else cur.out += -m.delta;
  }
  const movementTrend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

  return {
    currency: settings.currency,
    totalValue,
    itemCount: items.length,
    totalUnits,
    lowStockCount,
    deadStockCount: deadStock.length,
    valueByWarehouse,
    abc,
    deadStock,
    movementTrend,
  };
}

// ─── Dokumenty (PZ / WZ / faktura) ──────────────────────────────────────────

export type StorageDocumentWithLines = StorageDocument & {
  lines: StorageDocumentLine[];
  supplier: StorageSupplier | null;
};

export interface DocumentLineInput {
  itemId?: string | null;
  name: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
}

export interface DocumentInput {
  type: "PZ" | "WZ" | "faktura";
  number?: string | null;
  supplierId?: string | null;
  date?: Date | string | null;
  imageUrl?: string | null;
  notes?: string | null;
  lines: DocumentLineInput[];
  teamId?: string | null;
  /** Czy zaksięgować na stan (PZ/faktura: +, WZ: −). */
  applyToStock?: boolean;
}

export async function getDocuments(): Promise<StorageDocumentWithLines[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  return prisma.storageDocument.findMany({
    where: { OR: ownershipOr(user.id, teamIds) },
    include: { lines: true, supplier: true },
    orderBy: { date: "desc" },
  });
}

export async function getDocument(id: string): Promise<StorageDocumentWithLines | null> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const doc = await prisma.storageDocument.findUnique({
    where: { id },
    include: { lines: true, supplier: true },
  });
  if (!doc) return null;
  if (doc.ownerId !== user.id && (!doc.ownerTeamId || !teamIds.includes(doc.ownerTeamId))) {
    throw new Error("Brak dostępu do dokumentu");
  }
  return doc;
}

export async function createDocument(data: DocumentInput): Promise<StorageDocument> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  if (data.teamId && !teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego teamu");

  const lines = data.lines.map((l) => ({ ...l, name: l.name.trim() })).filter((l) => l.name);
  const totalCost = lines.reduce((a, l) => a + (l.unitPrice ?? 0) * (l.quantity ?? 0), 0) || null;
  const sign = data.type === "WZ" ? -1 : 1;

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.storageDocument.create({
      data: {
        type: data.type,
        number: data.number?.trim() || null,
        supplierId: data.supplierId || null,
        date: toDate(data.date) ?? new Date(),
        totalCost,
        imageUrl: data.imageUrl || null,
        notes: data.notes?.trim() || null,
        ownerId: data.teamId ? null : user.id,
        ownerTeamId: data.teamId ?? null,
        lines: {
          create: lines.map((l) => ({
            itemId: l.itemId || null,
            name: l.name,
            quantity: l.quantity,
            unit: l.unit?.trim() || null,
            unitPrice: l.unitPrice ?? null,
            lineTotal: l.unitPrice != null ? l.unitPrice * l.quantity : null,
          })),
        },
      },
      include: { lines: true },
    });

    if (data.applyToStock) {
      const ownClause = data.teamId ? { ownerTeamId: data.teamId } : { ownerId: user.id };
      for (const l of created.lines) {
        // Dopasuj istniejącą pozycję po itemId lub nazwie, inaczej utwórz.
        let target = l.itemId
          ? await tx.storageItem.findUnique({ where: { id: l.itemId } })
          : await tx.storageItem.findFirst({
              where: { name: { equals: l.name, mode: "insensitive" }, ...ownClause },
            });
        if (!target) {
          target = await tx.storageItem.create({
            data: {
              name: l.name,
              quantity: 0,
              unit: l.unit,
              unitPrice: l.unitPrice,
              supplierId: data.supplierId || null,
              ...ownClause,
            },
          });
        }
        const next = Math.max(0, (target.quantity ?? 0) + sign * l.quantity);
        await tx.storageItem.update({
          where: { id: target.id },
          data: { quantity: next, ...(l.unitPrice != null ? { unitPrice: l.unitPrice } : {}) },
        });
        await tx.storageMovement.create({
          data: {
            itemId: target.id,
            delta: sign * l.quantity,
            reason: data.type === "WZ" ? "wydanie" : "przyjęcie",
            note: `dok. ${data.type}${created.number ? " " + created.number : ""}`,
            documentId: created.id,
          },
        });
      }
    }
    return created;
  });

  void trackActivity("magazynowanie", "document", { id: doc.id, type: data.type });
  revalidatePath("/magazynowanie/dokumenty");
  revalidatePath("/magazynowanie");
  return doc;
}

export async function deleteDocument(id: string): Promise<void> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const doc = await prisma.storageDocument.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  if (!doc) return;
  if (doc.ownerId !== user.id && (!doc.ownerTeamId || !teamIds.includes(doc.ownerTeamId))) {
    throw new Error("Brak dostępu do dokumentu");
  }
  await prisma.storageDocument.delete({ where: { id } });
  revalidatePath("/magazynowanie/dokumenty");
}

// ─── Zamówienia do dostawców ────────────────────────────────────────────────

export type PurchaseOrderWithLines = StoragePurchaseOrder & {
  lines: StoragePurchaseOrderLine[];
  supplier: StorageSupplier | null;
};

export interface PurchaseOrderInput {
  supplierId?: string | null;
  notes?: string | null;
  lines: Array<{ itemId?: string | null; name: string; quantity: number; unit?: string | null }>;
  teamId?: string | null;
}

export async function getPurchaseOrders(): Promise<PurchaseOrderWithLines[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  return prisma.storagePurchaseOrder.findMany({
    where: { OR: ownershipOr(user.id, teamIds) },
    include: { lines: true, supplier: true },
    orderBy: { date: "desc" },
  });
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderWithLines | null> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const po = await prisma.storagePurchaseOrder.findUnique({
    where: { id },
    include: { lines: true, supplier: true },
  });
  if (!po) return null;
  if (po.ownerId !== user.id && (!po.ownerTeamId || !teamIds.includes(po.ownerTeamId))) {
    throw new Error("Brak dostępu do zamówienia");
  }
  return po;
}

export async function createPurchaseOrder(data: PurchaseOrderInput): Promise<StoragePurchaseOrder> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  if (data.teamId && !teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  const lines = data.lines.map((l) => ({ ...l, name: l.name.trim() })).filter((l) => l.name);

  const po = await prisma.storagePurchaseOrder.create({
    data: {
      supplierId: data.supplierId || null,
      notes: data.notes?.trim() || null,
      ownerId: data.teamId ? null : user.id,
      ownerTeamId: data.teamId ?? null,
      lines: {
        create: lines.map((l) => ({
          itemId: l.itemId || null,
          name: l.name,
          quantity: l.quantity,
          unit: l.unit?.trim() || null,
        })),
      },
    },
  });
  revalidatePath("/magazynowanie/zamowienia");
  return po;
}

export async function updatePurchaseOrder(
  id: string,
  patch: { status?: "draft" | "sent" | "received"; draftText?: string | null; notes?: string | null }
): Promise<void> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const po = await prisma.storagePurchaseOrder.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  if (!po) throw new Error("Zamówienie nie istnieje");
  if (po.ownerId !== user.id && (!po.ownerTeamId || !teamIds.includes(po.ownerTeamId))) {
    throw new Error("Brak dostępu do zamówienia");
  }
  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.draftText !== undefined) data.draftText = patch.draftText;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  await prisma.storagePurchaseOrder.update({ where: { id }, data });
  revalidatePath("/magazynowanie/zamowienia");
  revalidatePath(`/magazynowanie/zamowienia/${id}`);
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const po = await prisma.storagePurchaseOrder.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  if (!po) return;
  if (po.ownerId !== user.id && (!po.ownerTeamId || !teamIds.includes(po.ownerTeamId))) {
    throw new Error("Brak dostępu do zamówienia");
  }
  await prisma.storagePurchaseOrder.delete({ where: { id } });
  revalidatePath("/magazynowanie/zamowienia");
}
