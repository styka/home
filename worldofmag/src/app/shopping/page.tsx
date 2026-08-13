import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { getListSummaries } from "@/modules/shopping/actions/lists";
import { getUserTeamIds, ownedWhereAsync } from "@/platform/auth/serverUtils";
import { ShoppingHomePage } from "@/modules/shopping/ui/ShoppingHomePage";

export const dynamic = "force-dynamic";

export default async function ShoppingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const teamIds = await getUserTeamIds(userId);
  const accessFilter = {
    ...(await ownedWhereAsync(userId)),
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
