"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import { parseQuantity } from "@/lib/parseQuantity";
import { assertListAccess } from "@/actions/lists";
import { upsertUserProduct } from "@/actions/products";
import type { Item, ItemStatus, ItemHistory } from "@/types";
import type { Item as PrismaItem } from "@prisma/client";

function toItem(p: PrismaItem): Item {
  return p as unknown as Item;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string };
}

export async function addItem(listId: string, rawText: string): Promise<Item> {
  const user = await requireAuth();
  await assertListAccess(listId, user.id);

  const { name, quantity, unit } = parseQuantity(rawText.trim());
  const category = categorize(name);

  const item = await prisma.item.create({
    data: { listId, name, quantity, unit, category },
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

  revalidatePath(`/shopping/${listId}`);
  return toItem(item);
}

export async function updateItemStatus(id: string, status: ItemStatus): Promise<Item> {
  const user = await requireAuth();
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found");
  await assertListAccess(existing.listId, user.id);

  const item = await prisma.item.update({ where: { id }, data: { status } });
  revalidatePath(`/shopping/${item.listId}`);
  return toItem(item);
}

export async function updateItem(
  id: string,
  patch: { name?: string; quantity?: number | null; unit?: string | null; notes?: string | null; priority?: number }
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
    data: { listId, name: trimmedName, quantity, unit, category: resolvedCategory },
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

export async function getSuggestionsForPrefix(prefix: string): Promise<ItemHistory[]> {
  if (!prefix || prefix.length < 1) return [];
  return prisma.itemHistory.findMany({
    where: { name: { contains: prefix.toLowerCase() } },
    orderBy: { useCount: "desc" },
    take: 8,
  });
}
