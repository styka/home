import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { getLists, assertListAccess } from "@/modules/shopping/actions/lists";
import { getCategoryEmojiMap, getCategoryNames } from "@/modules/shopping/actions/categories";
import { getStores } from "@/modules/shopping/actions/stores";
import { ShoppingPage } from "@/modules/shopping/ui/ShoppingPage";
import type { ShoppingListWithItems } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { listId: string };
  /** 043: stan widoku (zakładka filtra, sortowanie) czytany przez `useViewState` po stronie klienta. */
  searchParams?: { filter?: string; sort?: string };
}

export default async function ListPage({ params, searchParams }: Props) {
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

  return <ShoppingPage list={list as unknown as ShoppingListWithItems} allLists={allLists} categoryEmojiMap={categoryEmojiMap} categoryNames={categoryNames} stores={stores} financeReady={!!finance?.autoExpenseElementId} viewParams={searchParams ?? {}} />;
}
