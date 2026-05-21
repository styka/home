export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecentActivity } from "@/actions/activity";
import { getTodaysMeals } from "@/actions/mealPlans";
import { getExpiringSoon } from "@/actions/pantry";
import { HomePage, type KitchenWidgetData } from "@/components/home/HomePage";

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

  const userRoles: string[] = session.user.roles ?? [];
  const userPermissions: string[] = session.user.permissions ?? [];

  let kitchenWidget: KitchenWidgetData | null = null;
  if (userPermissions.includes("module.kitchen")) {
    try {
      const [todayMeals, expiring] = await Promise.all([getTodaysMeals(), getExpiringSoon(3)]);
      kitchenWidget = {
        todayMeals: todayMeals.map((m) => ({
          id: m.id,
          slot: m.slot,
          title: m.recipe?.title ?? m.customTitle ?? "—",
          servings: m.servings,
          recipeSlug: m.recipe?.slug ?? null,
        })),
        expiring: expiring.slice(0, 3).map((e) => {
          const d = e.expiresAt ? new Date(e.expiresAt) : null;
          const days = d
            ? Math.floor((d.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return { id: e.id, name: e.name, daysLeft: days };
        }),
      };
    } catch {
      kitchenWidget = null;
    }
  }

  return (
    <HomePage
      userName={session.user.name ?? null}
      pendingItems={pendingItems}
      todayTasks={todayTasks}
      overdueTasks={overdueTasks}
      recentActivity={recentActivity}
      userRoles={userRoles}
      userPermissions={userPermissions}
      kitchenWidget={kitchenWidget}
    />
  );
}
