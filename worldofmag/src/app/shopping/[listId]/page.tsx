import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLists, assertListAccess } from "@/actions/lists";
import { getCategoryEmojiMap, getCategoryNames } from "@/actions/categories";
import { getStores } from "@/actions/stores";
import { ShoppingPage } from "@/components/shopping/ShoppingPage";
import type { ShoppingListWithItems } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { listId: string };
}

export default async function ListPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  // Verify access before fetching full data
  try {
    await assertListAccess(params.listId, session.user.id);
  } catch {
    notFound();
  }

  const [list, allLists, categoryEmojiMap, categoryNames, stores, finance] = await Promise.all([
    prisma.shoppingList.findUnique({
      where: { id: params.listId },
      // Z-221 (T-03): ręczna kolejność (order ASC) ma pierwszeństwo; przy braku ręcznego
      // ułożenia (wszystko order=0) fallback na priority/createdAt = dotychczasowe zachowanie.
      include: { items: { orderBy: [{ order: "asc" }, { priority: "desc" }, { createdAt: "asc" }] } },
    }),
    getLists(),
    getCategoryEmojiMap(),
    getCategoryNames(),
    getStores(),
    prisma.financeSettings.findUnique({ where: { userId: session.user.id }, select: { autoExpenseElementId: true } }),
  ]);

  if (!list) notFound();

  return <ShoppingPage list={list as unknown as ShoppingListWithItems} allLists={allLists} categoryEmojiMap={categoryEmojiMap} categoryNames={categoryNames} stores={stores} financeReady={!!finance?.autoExpenseElementId} />;
}
