export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { getRecentActivity } from "@/actions/activity";
import { getTodaysMeals } from "@/actions/mealPlans";
import { getExpiringSoon } from "@/actions/pantry";
import { getPendingInvitationsCount } from "@/actions/invitations";
import { HomePage } from "@/components/home/HomePage";
import type { TaskPriority } from "@/types";

export default async function HomePageRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const userRoles: string[] = session.user.roles ?? [];
  const userPermissions: string[] = session.user.permissions ?? [];
  const isAdmin = userRoles.includes("ADMIN");
  const has = (slug: string) => userPermissions.includes(slug);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const teamIds = await getUserTeamIds(userId);
  const reportAccessFilter = {
    OR: [
      { authorId: userId },
      { authorId: null },
      ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
    ],
  };

  // Always fetched: shopping data + recent activity + invitations + reports count
  const [userLists, recentActivity, pendingInvitations, recentReports] = await Promise.all([
    has("module.shopping")
      ? prisma.shoppingList.findMany({
          where: {
            archived: false,
            OR: [
              { ownerId: userId },
              ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
            ],
          },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
    getRecentActivity(20),
    getPendingInvitationsCount(),
    prisma.report.count({
      where: { createdAt: { gte: sevenDaysAgo }, ...reportAccessFilter },
    }),
  ]);

  const listIds = userLists.map((l) => l.id);
  const pendingItems =
    has("module.shopping") && listIds.length > 0
      ? await prisma.item.count({ where: { listId: { in: listIds }, status: "NEEDED" } })
      : 0;

  // Tasks (conditional)
  let todayTasks = 0;
  let overdueTasks = 0;
  let todayTaskPreview: Array<{
    id: string;
    title: string;
    priority: TaskPriority;
    projectId: string | null;
    projectName: string | null;
    projectEmoji: string | null;
  }> = [];

  if (has("module.tasks")) {
    const [todayCnt, overdueCnt, todayList] = await Promise.all([
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
      prisma.task.findMany({
        where: {
          OR: [{ createdById: userId }, { assigneeId: userId }],
          dueDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 3,
        include: { project: { select: { id: true, name: true, emoji: true } } },
      }),
    ]);
    todayTasks = todayCnt;
    overdueTasks = overdueCnt;
    todayTaskPreview = todayList.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority as TaskPriority,
      projectId: t.projectId,
      projectName: t.project?.name ?? null,
      projectEmoji: t.project?.emoji ?? null,
    }));
  }

  // Notes (conditional)
  let pinnedNotes = 0;
  if (has("module.notes")) {
    pinnedNotes = await prisma.note.count({
      where: {
        OR: [
          { ownerId: userId },
          ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
        ],
        pinned: true,
      },
    });
  }

  // Kitchen (conditional)
  let todayMealsForUI: Array<{ id: string; slot: string; title: string; servings: number; recipeSlug: string | null }> = [];
  let expiringCount = 0;

  if (has("module.kitchen")) {
    try {
      const [todayMeals, expiring] = await Promise.all([getTodaysMeals(), getExpiringSoon(3)]);
      todayMealsForUI = todayMeals.map((m) => ({
        id: m.id,
        slot: m.slot,
        title: m.recipe?.title ?? m.customTitle ?? "—",
        servings: m.servings,
        recipeSlug: m.recipe?.slug ?? null,
      }));
      expiringCount = expiring.length;
    } catch {
      todayMealsForUI = [];
      expiringCount = 0;
    }
  }

  // Admin stats (conditional)
  let adminStats: { userCount: number; teamCount: number; reportCount: number } | null = null;
  if (isAdmin) {
    const [userCount, teamCount, reportCount] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.report.count(),
    ]);
    adminStats = { userCount, teamCount, reportCount };
  }

  const recentActivityForUI = recentActivity.map((a) => ({
    module: a.module,
    action: a.action,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
  }));

  return (
    <HomePage
      userName={session.user.name ?? null}
      userRoles={userRoles}
      userPermissions={userPermissions}
      isAdmin={isAdmin}
      pendingInvitations={pendingInvitations}
      pendingItems={pendingItems}
      todayTasks={todayTasks}
      overdueTasks={overdueTasks}
      todayTaskPreview={todayTaskPreview}
      pinnedNotes={pinnedNotes}
      todayMeals={todayMealsForUI}
      expiringSoon={expiringCount}
      recentReports={recentReports}
      recentActivity={recentActivityForUI}
      adminStats={adminStats}
    />
  );
}
