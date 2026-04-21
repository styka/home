"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ShoppingList } from "@/types";

export async function getLists(): Promise<ShoppingList[]> {
  return prisma.shoppingList.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createList(name: string): Promise<ShoppingList> {
  const list = await prisma.shoppingList.create({ data: { name: name.trim() } });
  revalidatePath("/shopping");
  return list;
}

export async function renameList(id: string, name: string): Promise<ShoppingList> {
  const list = await prisma.shoppingList.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/shopping");
  revalidatePath(`/shopping/${id}`);
  return list;
}

export async function deleteList(id: string): Promise<void> {
  await prisma.shoppingList.delete({ where: { id } });
  revalidatePath("/shopping");
}
