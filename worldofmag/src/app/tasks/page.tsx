import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjects } from "@/actions/taskProjects";
import { userDayBounds } from "@/lib/userTime";
import { TasksHomePage } from "@/components/tasks/TasksHomePage";

export const dynamic = "force-dynamic";

export default async function TasksIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const { start: todayStart, end: todayEnd } = userDayBounds();

  const [projects, todayCount, upcomingCount, overdueCount, todayTasks] = await Promise.all([
    getTaskProjects(),
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
        dueDate: { gt: todayEnd },
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
      take: 5,
      include: { project: { select: { id: true, name: true, emoji: true } } },
    }),
  ]);

  const todayPreview = todayTasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority as "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    projectId: t.projectId,
    projectName: t.project?.name ?? null,
    projectEmoji: t.project?.emoji ?? null,
  }));

  return (
    <TasksHomePage
      projects={projects}
      todayCount={todayCount}
      upcomingCount={upcomingCount}
      overdueCount={overdueCount}
      todayPreview={todayPreview}
    />
  );
}
