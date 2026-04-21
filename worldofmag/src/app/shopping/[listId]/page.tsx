import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ShoppingPage } from "@/components/shopping/ShoppingPage";
import type { ShoppingListWithItems } from "@/types";

interface Props {
  params: { listId: string };
}

export default async function ListPage({ params }: Props) {
  const [list, allLists] = await Promise.all([
    prisma.shoppingList.findUnique({
      where: { id: params.listId },
      include: { items: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }] } },
    }),
    prisma.shoppingList.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  if (!list) notFound();

  return <ShoppingPage list={list as unknown as ShoppingListWithItems} allLists={allLists} />;
}
