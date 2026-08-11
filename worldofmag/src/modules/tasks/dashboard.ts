import type { DashboardContributor, DashboardContext } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import type { TaskPriority } from "@/types";
import { prisma } from "@/platform/db/prisma";

/**
 * 050: wkład Zadań do migawki pulpitu — trzy pola z trzech zapytań puszczonych równolegle.
 *
 * Zapytania **przeniesione bez zmiany** z trasy: ten sam warunek zakresu (`createdById` LUB
 * `assigneeId` — Zadania na pulpicie są osobiste, nie zespołowe), te same granice dnia z kontekstu,
 * to samo `notIn: ["DONE", "CANCELLED"]`, ta sama kolejność sortowania i `take: 3`.
 */
const wklad: DashboardContributor<
  Pick<DashboardSnapshot, "todayTasks" | "overdueTasks" | "todayTaskPreview">
> = async (userId, ctx: DashboardContext) => {
  const zakres = { OR: [{ createdById: userId }, { assigneeId: userId }] };
  const [todayTasks, overdueTasks, todayList] = await Promise.all([
    prisma.task.count({
      where: {
        ...zakres,
        dueDate: { gte: ctx.todayStart, lte: ctx.todayEnd },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
    prisma.task.count({
      where: {
        ...zakres,
        dueDate: { lt: ctx.todayStart },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
    prisma.task.findMany({
      where: {
        ...zakres,
        dueDate: { gte: ctx.todayStart, lte: ctx.todayEnd },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 3,
      include: { project: { select: { id: true, name: true, emoji: true } } },
    }),
  ]);

  return {
    todayTasks,
    overdueTasks,
    todayTaskPreview: todayList.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority as TaskPriority,
      projectId: t.projectId,
      projectName: t.project?.name ?? null,
      projectEmoji: t.project?.emoji ?? null,
    })),
  };
};

export default wklad;
