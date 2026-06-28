"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { categorize } from "@/lib/categorize";
import { parseQuantity } from "@/lib/parseQuantity";
import { assertListAccess } from "@/actions/lists";
import { upsertUserProduct } from "@/actions/products";
import { trackActivity } from "@/actions/activity";
import type { Item, ItemStatus, ItemHistory } from "@/types";
import type { Item as PrismaItem } from "@prisma/client";

function toItem(p: PrismaItem): Item {
  return p as unknown as Item;
}

// Z-221 (T-03): nowe pozycje dopisywane na KONIEC swojej kategorii (max order + 1),
// by nie rozbijały ręcznie ułożonej kolejności. Brak pozycji w kategorii → 0.
async function nextCategoryOrder(listId: string, category: string): Promise<number> {
  const agg = await prisma.item.aggregate({ where: { listId, category }, _max: { order: true } });
  return (agg._max.order ?? -1) + 1;
}

export async function addItem(listId: string, rawText: string): Promise<Item> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);

  const { name, quantity, unit } = parseQuantity(rawText.trim());
  const category = categorize(name);

  const item = await prisma.item.create({
    data: { listId, name, quantity, unit, category, order: await nextCategoryOrder(listId, category) },
  });

  await prisma.itemHistory.upsert({
    where: { name: name.toLowerCase() },
    update: {
      useCount: { increment: 1 },
      category,
      unit: unit ?? undefined,
      updatedAt: new Date(),
    },
    create: { name: name.toLowerCase(), category, unit: unit ?? null },
  });

  await upsertUserProduct(name.toLowerCase(), unit ?? null, category);
  void trackActivity("shopping", "add_item", { name, listId });

  revalidatePath(`/shopping/${listId}`);
  return toItem(item);
}

export async function updateItemStatus(id: string, status: ItemStatus): Promise<Item> {
  const user = await requireAuth();
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found");
  await assertListAccess(existing.listId, user.id);

  const item = await prisma.item.update({ where: { id }, data: { status } });
  void trackActivity("shopping", "update_item_status", { id, status });
  revalidatePath(`/shopping/${item.listId}`);
  return toItem(item);
}

export async function updateItem(
  id: string,
  patch: { name?: string; quantity?: number | null; unit?: string | null; notes?: string | null; priority?: number; price?: number | null }
): Promise<Item> {
  const user = await requireAuth();
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found");
  await assertListAccess(existing.listId, user.id);

  if (patch.name) patch = { ...patch, name: patch.name.trim() };
  const item = await prisma.item.update({ where: { id }, data: patch });
  revalidatePath(`/shopping/${item.listId}`);
  return toItem(item);
}

export async function moveItem(id: string, targetListId: string): Promise<Item> {
  const user = await requireAuth();
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found");
  await assertListAccess(existing.listId, user.id);
  if (targetListId === existing.listId) return toItem(existing);
  // Dostęp do listy docelowej też musi być sprawdzony.
  await assertListAccess(targetListId, user.id);

  const item = await prisma.item.update({ where: { id }, data: { listId: targetListId } });
  void trackActivity("shopping", "move_item", { id, from: existing.listId, to: targetListId });
  revalidatePath(`/shopping/${existing.listId}`);
  revalidatePath(`/shopping/${targetListId}`);
  return toItem(item);
}

export async function deleteItem(id: string): Promise<void> {
  const user = await requireAuth();
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return;
  await assertListAccess(item.listId, user.id);
  await prisma.item.delete({ where: { id } });
  revalidatePath(`/shopping/${item.listId}`);
}

export async function clearDoneItems(listId: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);
  await prisma.item.deleteMany({ where: { listId, status: "DONE" } });
  revalidatePath(`/shopping/${listId}`);
}

export async function markAllInCart(listId: string): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);
  await prisma.item.updateMany({
    where: { listId, status: "NEEDED" },
    data: { status: "IN_CART" },
  });
  revalidatePath(`/shopping/${listId}`);
}

export async function addItemStructured(
  listId: string,
  name: string,
  quantity: number | null,
  unit: string | null,
  category?: string
): Promise<Item> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);

  const trimmedName = name.trim().toLowerCase();
  const resolvedCategory = category?.trim() || categorize(trimmedName);

  const item = await prisma.item.create({
    data: { listId, name: trimmedName, quantity, unit, category: resolvedCategory, order: await nextCategoryOrder(listId, resolvedCategory) },
  });

  // Update legacy ItemHistory
  await prisma.itemHistory.upsert({
    where: { name: trimmedName },
    update: { useCount: { increment: 1 }, category: resolvedCategory, unit: unit ?? undefined, updatedAt: new Date() },
    create: { name: trimmedName, category: resolvedCategory, unit },
  });

  // Update product catalog
  await upsertUserProduct(trimmedName, unit, resolvedCategory);

  revalidatePath(`/shopping/${listId}`);
  return toItem(item);
}

/**
 * Z-221 (T-03): zapis ręcznej kolejności pozycji w obrębie JEDNEJ kategorii.
 * `orderedIds` to pełna, docelowa kolejność widocznych pozycji danej kategorii — zapisujemy
 * `order = index`. Filtrujemy do pozycji faktycznie należących do (listId, category), więc obce
 * id są ignorowane. Pozycje spoza przekazanej listy (np. ukryte filtrem) zachowują swój order.
 */
export async function reorderItems(listId: string, category: string, orderedIds: string[]): Promise<void> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);

  const valid = await prisma.item.findMany({
    where: { id: { in: orderedIds }, listId, category },
    select: { id: true },
  });
  const validSet = new Set(valid.map((i) => i.id));
  const ops = orderedIds
    .filter((id) => validSet.has(id))
    .map((id, index) => prisma.item.update({ where: { id }, data: { order: index } }));
  if (ops.length === 0) return;

  await prisma.$transaction(ops);
  void trackActivity("shopping", "reorder_items", { listId, category, count: ops.length });
  revalidatePath(`/shopping/${listId}`);
}

export async function getSuggestionsForPrefix(prefix: string): Promise<ItemHistory[]> {
  if (!prefix || prefix.length < 1) return [];
  return prisma.itemHistory.findMany({
    where: { name: { contains: prefix.toLowerCase() } },
    orderBy: { useCount: "desc" },
    take: 8,
  });
}
