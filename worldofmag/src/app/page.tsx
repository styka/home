export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecentActivity } from "@/actions/activity";
import { HomePage } from "@/components/home/HomePage";

export default async function HomePageRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [userLists, todayTasks, overdueTasks, recentActivity] = await Promise.all([
    prisma.shoppingList.findMany({
      where: { ownerId: userId },
      select: { id: true },
    }),
    prisma.task.count({
      where: {
        OR: [{ createdById: userId }, { assigneeId: userId }],
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
    prisma.task.count({
      where: {
        OR: [{ createdById: userId }, { assigneeId: userId }],
        dueDate: { lt: todayStart },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
    getRecentActivity(30),
  ]);

  const listIds = userLists.map((l) => l.id);
  const pendingItems = listIds.length > 0
    ? await prisma.item.count({ where: { listId: { in: listIds }, status: "NEEDED" } })
    : 0;

  return (
    <HomePage
      userName={session.user.name ?? null}
      pendingItems={pendingItems}
      todayTasks={todayTasks}
      overdueTasks={overdueTasks}
      recentActivity={recentActivity}
    />
  );
}
