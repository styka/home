"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import type { StoreWithGraph } from "@/types";

export async function getStores(): Promise<StoreWithGraph[]> {
  const user = await requireAuth();
  return prisma.store.findMany({
    where: { ownerId: user.id },
    include: { nodes: true, edges: true },
    orderBy: { createdAt: "asc" },
  }) as unknown as Promise<StoreWithGraph[]>;
}

export async function createStore(name: string): Promise<StoreWithGraph> {
  const user = await requireAuth();
  const store = await prisma.store.create({
    data: { name: name.trim(), ownerId: user.id },
    include: { nodes: true, edges: true },
  });
  revalidatePath("/shopping");
  return store as unknown as StoreWithGraph;
}

export async function renameStore(id: string, name: string): Promise<void> {
  const user = await requireAuth();
  await assertStoreAccess(id, user.id);
  await prisma.store.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/shopping");
  revalidatePath(`/shopping/stores/${id}`);
}

export async function deleteStore(id: string): Promise<void> {
  const user = await requireAuth();
  await assertStoreAccess(id, user.id);
  await prisma.store.delete({ where: { id } });
  revalidatePath("/shopping");
}

export async function getStore(id: string): Promise<StoreWithGraph> {
  const user = await requireAuth();
  await assertStoreAccess(id, user.id);
  const store = await prisma.store.findUnique({
    where: { id },
    include: { nodes: true, edges: true },
  });
  if (!store) throw new Error("Store not found");
  return store as unknown as StoreWithGraph;
}

export async function upsertStoreNode(
  storeId: string,
  node: { id?: string; label: string; type: string; category: string | null; x: number; y: number }
): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertStoreAccess(storeId, user.id);
  if (node.id) {
    const updated = await prisma.storeNode.update({
      where: { id: node.id },
      data: { label: node.label, type: node.type, category: node.category, x: node.x, y: node.y },
    });
    revalidatePath(`/shopping/stores/${storeId}`);
    return { id: updated.id };
  } else {
    const created = await prisma.storeNode.create({
      data: { storeId, label: node.label, type: node.type, category: node.category, x: node.x, y: node.y },
    });
    revalidatePath(`/shopping/stores/${storeId}`);
    return { id: created.id };
  }
}

export async function deleteStoreNode(nodeId: string): Promise<void> {
  const user = await requireAuth();
  const node = await prisma.storeNode.findUnique({ where: { id: nodeId }, select: { storeId: true } });
  if (!node) return;
  await assertStoreAccess(node.storeId, user.id);
  await prisma.storeNode.delete({ where: { id: nodeId } });
  revalidatePath(`/shopping/stores/${node.storeId}`);
}

export async function upsertStoreEdge(
  storeId: string,
  edge: { id?: string; fromId: string; toId: string; weight: number }
): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertStoreAccess(storeId, user.id);
  if (edge.id) {
    const updated = await prisma.storeEdge.update({
      where: { id: edge.id },
      data: { weight: edge.weight },
    });
    revalidatePath(`/shopping/stores/${storeId}`);
    return { id: updated.id };
  } else {
    const created = await prisma.storeEdge.create({
      data: { storeId, fromId: edge.fromId, toId: edge.toId, weight: edge.weight },
    });
    revalidatePath(`/shopping/stores/${storeId}`);
    return { id: created.id };
  }
}

export async function deleteStoreEdge(edgeId: string): Promise<void> {
  const user = await requireAuth();
  const edge = await prisma.storeEdge.findUnique({ where: { id: edgeId }, select: { storeId: true } });
  if (!edge) return;
  await assertStoreAccess(edge.storeId, user.id);
  await prisma.storeEdge.delete({ where: { id: edgeId } });
  revalidatePath(`/shopping/stores/${edge.storeId}`);
}

export async function saveStoreGraph(
  storeId: string,
  nodes: Array<{ tempId: string; label: string; type: string; category: string | null; x: number; y: number }>,
  edges: Array<{ fromTempId: string; toTempId: string; weight: number }>
): Promise<void> {
  const user = await requireAuth();
  await assertStoreAccess(storeId, user.id);

  await prisma.$transaction(async (tx) => {
    await tx.storeNode.deleteMany({ where: { storeId } });

    const idMap = new Map<string, string>();
    for (const node of nodes) {
      const created = await tx.storeNode.create({
        data: { storeId, label: node.label, type: node.type, category: node.category, x: node.x, y: node.y },
      });
      idMap.set(node.tempId, created.id);
    }

    for (const edge of edges) {
      const fromId = idMap.get(edge.fromTempId);
      const toId = idMap.get(edge.toTempId);
      if (!fromId || !toId) continue;
      await tx.storeEdge.create({ data: { storeId, fromId, toId, weight: edge.weight } });
    }
  });

  revalidatePath(`/shopping/stores/${storeId}`);
  revalidatePath("/shopping");
}

async function assertStoreAccess(storeId: string, userId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store || store.ownerId !== userId) throw new Error("Access denied");
}
