import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getListSummaries } from "@/actions/lists";
import { getUserTeamIds } from "@/lib/server-utils";
import { ShoppingHomePage } from "@/components/shopping/ShoppingHomePage";

export const dynamic = "force-dynamic";

export default async function ShoppingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const teamIds = await getUserTeamIds(userId);
  const accessFilter = {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };

  const [lists, archived, totalPending, recentItems] = await Promise.all([
    getListSummaries(false),
    getListSummaries(true),
    prisma.item.count({
      where: {
        status: "NEEDED",
        list: { archived: false, ...accessFilter },
      },
    }),
    prisma.item.findMany({
      where: {
        status: "NEEDED",
        list: { archived: false, ...accessFilter },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { list: { select: { id: true, name: true } } },
    }),
  ]);

  const recentItemsForUI = recentItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    listId: item.list.id,
    listName: item.list.name,
  }));

  return (
    <ShoppingHomePage
      lists={lists}
      archivedLists={archived}
      totalPending={totalPending}
      recentItems={recentItemsForUI}
    />
  );
}
