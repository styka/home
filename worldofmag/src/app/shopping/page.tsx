import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLists, getArchivedLists } from "@/actions/lists";
import { prisma } from "@/lib/prisma";
import { ShoppingHomePage } from "@/components/shopping/ShoppingHomePage";

export const dynamic = "force-dynamic";

async function buildListSummaries(lists: Awaited<ReturnType<typeof getLists>>) {
  return Promise.all(
    lists.map(async (list) => {
      const [pendingCount, totalCount] = await Promise.all([
        prisma.item.count({ where: { listId: list.id, status: "NEEDED" } }),
        prisma.item.count({ where: { listId: list.id } }),
      ]);
      return {
        id: list.id,
        name: list.name,
        pendingCount,
        totalCount,
        teamName: (list as { ownerTeam?: { name: string } | null }).ownerTeam?.name ?? null,
      };
    })
  );
}

export default async function ShoppingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [lists, archived] = await Promise.all([getLists(), getArchivedLists()]);
  const [listsWithCounts, archivedWithCounts] = await Promise.all([
    buildListSummaries(lists),
    buildListSummaries(archived),
  ]);

  return <ShoppingHomePage lists={listsWithCounts} archivedLists={archivedWithCounts} />;
}
