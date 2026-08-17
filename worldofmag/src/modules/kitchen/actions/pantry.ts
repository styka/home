"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth, getAccessibleTeamIds, getAccessibleWorkspaceIds, ownedWhereAsync, ownedOrAsync } from "@/platform/auth/serverUtils";
import { assertOwnership } from "@/platform/auth/ownership";
import { categorize } from "@/modules/shopping/contract";
import { trackActivity } from "@/actions/activity";
import { assertListAccess } from "@/modules/shopping/contract";
import type { PantryItem, Item } from "@prisma/client";
import { emitDomainEvent, workspaceIdDlaZdarzenia } from "@/platform/events/emit";
import { wlasnoscDoZapisu, przestrzenDoZapisu, przestrzenZespoluBezKontroliDostepu } from "@/platform/workspaces/zapis";

export type PantryItemWithProduct = PantryItem & {
  product: {
    id: string;
    name: string;
    category: string;
    defaultUnit: string | null;
  } | null;
};

async function assertPantryItemAccess(pantryItemId: string, userId: string): Promise<void> {
  // 079: dawny warunek szedł po `getUserTeamIds` (wszystkie zespoły, bez filtra modułu), więc
  // odpowiada mu pełny zakres przestrzeni z kontekstu dostępu.
  const item = await prisma.pantryItem.findUnique({
    where: { id: pantryItemId },
    select: { workspaceId: true },
  });
  if (!item) throw new Error("Pozycja w spiżarni nie istnieje");
  try {
    await assertOwnership(item, userId);
  } catch {
    throw new Error("Brak dostępu do tej pozycji");
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────

export async function getPantry(teamId?: string): Promise<PantryItemWithProduct[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");

  // 079: filtr „tylko ten zespół" idzie po przestrzeni zespołu; uprawnienie sprawdza warunek
  // wyżej, więc tłumaczenie identyfikatora funkcją bez kontroli dostępu jest tu na miejscu.
  const ownership = teamId
    ? teamIds.includes(teamId)
      ? [{ workspaceId: await przestrzenZespoluBezKontroliDostepu(teamId) }]
      : []
    : (await ownedOrAsync(user.id));

  if (ownership.length === 0) return [];

  return prisma.pantryItem.findMany({
    where: { OR: ownership },
    include: {
      product: {
        select: { id: true, name: true, category: true, defaultUnit: true },
      },
    },
    orderBy: [{ location: "asc" }, { name: "asc" }],
  });
}

export async function getExpiringSoon(days: number): Promise<PantryItemWithProduct[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  return prisma.pantryItem.findMany({
    where: {
      ...(await ownedWhereAsync(user.id)),
      expiresAt: { not: null, lte: threshold },
    },
    include: {
      product: { select: { id: true, name: true, category: true, defaultUnit: true } },
    },
    orderBy: { expiresAt: "asc" },
  });
}

export async function getAutoReplenishCandidates(): Promise<PantryItemWithProduct[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");

  const items = await prisma.pantryItem.findMany({
    where: {
      ...(await ownedWhereAsync(user.id)),
      autoShop: true,
      minQuantity: { not: null },
    },
    include: {
      product: { select: { id: true, name: true, category: true, defaultUnit: true } },
    },
  });

  return items.filter((i) => (i.quantity ?? 0) < (i.minQuantity ?? 0));
}

// ─── Write ────────────────────────────────────────────────────────────────

export interface PantryItemInput {
  name: string;
  productId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  location?: string | null;
  expiresAt?: Date | null;
  openedAt?: Date | null;
  minQuantity?: number | null;
  autoShop?: boolean;
  teamId?: string | null;
}

export async function addPantryItem(data: PantryItemInput): Promise<PantryItem> {
  const user = await requireAuth();

  if (data.teamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "kitchen");
    if (!teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const created = await prisma.pantryItem.create({
    data: {
      name: data.name.trim(),
      productId: data.productId ?? null,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      location: data.location ?? null,
      expiresAt: data.expiresAt ?? null,
      openedAt: data.openedAt ?? null,
      minQuantity: data.minQuantity ?? null,
      autoShop: data.autoShop ?? false,
      ...(await wlasnoscDoZapisu(user.id, data.teamId)),
    },
  });

  void trackActivity("kitchen", "add_pantry_item", { id: created.id, name: created.name });
  revalidatePath("/kitchen/pantry");
  revalidatePath("/");
  return created;
}

export async function updatePantryItem(
  id: string,
  patch: Partial<Omit<PantryItemInput, "teamId">>
): Promise<PantryItem> {
  const user = await requireAuth();
  await assertPantryItemAccess(id, user.id);

  const data: Record<string, unknown> = {};
  if (patch.name) data.name = patch.name.trim();
  if (patch.productId !== undefined) data.productId = patch.productId;
  if (patch.quantity !== undefined) data.quantity = patch.quantity;
  if (patch.unit !== undefined) data.unit = patch.unit;
  if (patch.location !== undefined) data.location = patch.location;
  if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt;
  if (patch.openedAt !== undefined) data.openedAt = patch.openedAt;
  if (patch.minQuantity !== undefined) data.minQuantity = patch.minQuantity;
  if (patch.autoShop !== undefined) data.autoShop = patch.autoShop;

  const updated = await prisma.pantryItem.update({ where: { id }, data });
  revalidatePath("/kitchen/pantry");
  revalidatePath("/");
  return updated;
}

export async function deletePantryItem(id: string): Promise<void> {
  const user = await requireAuth();
  await assertPantryItemAccess(id, user.id);
  await prisma.pantryItem.delete({ where: { id } });
  revalidatePath("/kitchen/pantry");
  revalidatePath("/");
}

export async function consumePantryItem(id: string, quantity: number): Promise<PantryItem> {
  const user = await requireAuth();
  await assertPantryItemAccess(id, user.id);
  const existing = await prisma.pantryItem.findUnique({ where: { id } });
  if (!existing) throw new Error("Pozycja nie istnieje");

  const next = Math.max(0, (existing.quantity ?? 0) - quantity);
  const updated = await prisma.pantryItem.update({
    where: { id },
    data: { quantity: next },
  });
  revalidatePath("/kitchen/pantry");
  return updated;
}

export async function setPantryQuantity(id: string, quantity: number): Promise<PantryItem> {
  const user = await requireAuth();
  await assertPantryItemAccess(id, user.id);
  const updated = await prisma.pantryItem.update({
    where: { id },
    data: { quantity },
  });
  revalidatePath("/kitchen/pantry");
  return updated;
}

export async function bulkSetPantryQuantities(
  updates: Array<{ id: string; quantity: number | null }>
): Promise<void> {
  const user = await requireAuth();
  await prisma.$transaction(async (tx) => {
    let zmienione = 0;
    // Przestrzeń zdarzenia bierzemy z ZASOBU (spis dotyczy pozycji jednej spiżarni), nie z autora
    // — inaczej spis zespołowy trafiłby do prywatnego strumienia klikającego.
    let przestrzenZasobu: string | null = null;
    for (const u of updates) {
      const item = await tx.pantryItem.findUnique({
        where: { id: u.id },
        select: { workspaceId: true },
      });
      if (!item) continue;
      if (!(await getAccessibleWorkspaceIds(user.id, "kitchen")).includes(item.workspaceId)) {
        throw new Error("Brak dostępu do pozycji");
      }
      await tx.pantryItem.update({
        where: { id: u.id },
        data: { quantity: u.quantity },
      });
      zmienione += 1;
      if (przestrzenZasobu === null) przestrzenZasobu = item.workspaceId;
    }
    const przestrzen = await workspaceIdDlaZdarzenia(przestrzenZasobu, user.id);
    // 070 (zadanie 21): JEDNO zdarzenie na spis, nie jedno na pozycję. Spis stu pozycji to dla
    // użytkownika JEDNA czynność; sto zdarzeń zamieniłoby się u odbiorcy (zadanie 25) w lawinę
    // powiadomień. Pilnuje tego kontrola 5 bramki `check:events` (deklaracja `ladunek: "zbiorczy"`).
    if (przestrzen && zmienione > 0) {
      await emitDomainEvent(tx, {
        workspaceId: przestrzen,
        module: "kitchen",
        type: "kuchnia.spizarnia.spisana",
        actorId: user.id,
        payload: { pozycji: zmienione },
      });
    }
  });
  revalidatePath("/kitchen/pantry");
}

// ─── Integration with shopping ────────────────────────────────────────────

export async function moveItemToPantry(
  itemId: string,
  pantryData?: Partial<PantryItemInput>
): Promise<PantryItem> {
  const user = await requireAuth();
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Pozycja zakupowa nie istnieje");
  await assertListAccess(item.listId, user.id);

  const productId =
    pantryData?.productId ??
    (await prisma.product.findFirst({
      where: { name: { equals: item.name, mode: "insensitive" } },
      select: { id: true },
    }))?.id ??
    null;

  // If team-shared list, prefer team ownership for pantry too.
  // 079: „lista należy do zespołu" czytamy z jej PRZESTRZENI — przestrzeń zespołowa ma wypełnione
  // `teamId` (lustro z zadania 9), więc przekład jest ścisły i nie zmienia rozgałęzienia niżej.
  const list = await prisma.shoppingList.findUnique({
    where: { id: item.listId },
    select: { workspaceId: true },
  });
  const przestrzenListy = list
    ? await prisma.workspace.findUnique({ where: { id: list.workspaceId }, select: { teamId: true } })
    : null;

  const teamId = pantryData?.teamId ?? przestrzenListy?.teamId ?? null;

  // Look for existing pantry item with same productId or name
  const existing = await prisma.pantryItem.findFirst({
    where: {
      AND: [
        productId ? { productId } : { name: { equals: item.name, mode: "insensitive" } },
        { workspaceId: await przestrzenDoZapisu(user.id, teamId) },
      ],
    },
  });

  if (existing) {
    const added = item.quantity ?? 0;
    const updated = await prisma.pantryItem.update({
      where: { id: existing.id },
      data: {
        quantity: (existing.quantity ?? 0) + added,
        unit: existing.unit ?? item.unit,
      },
    });
    revalidatePath("/kitchen/pantry");
    return updated;
  }

  const created = await prisma.pantryItem.create({
    data: {
      name: pantryData?.name ?? item.name,
      productId,
      quantity: pantryData?.quantity ?? item.quantity,
      unit: pantryData?.unit ?? item.unit,
      location: pantryData?.location ?? null,
      ...(await wlasnoscDoZapisu(user.id, teamId)),
    },
  });
  revalidatePath("/kitchen/pantry");
  return created;
}

export async function autoReplenishToList(listId: string): Promise<{ addedItems: Item[] }> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);

  const candidates = await getAutoReplenishCandidates();
  const added: Item[] = [];

  for (const c of candidates) {
    const deficit =
      c.minQuantity != null
        ? Math.max(c.minQuantity - (c.quantity ?? 0), c.minQuantity)
        : null;
    const created = await prisma.item.create({
      data: {
        listId,
        name: c.product?.name ?? c.name,
        quantity: deficit ?? null,
        unit: c.unit ?? c.product?.defaultUnit ?? null,
        category: c.product?.category ?? categorize(c.name),
      },
    });
    added.push(created);
  }

  void trackActivity("kitchen", "auto_replenish", { listId, count: added.length });
  revalidatePath(`/shopping/${listId}`);
  return { addedItems: added };
}
