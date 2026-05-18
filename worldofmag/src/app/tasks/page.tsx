import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjects } from "@/actions/taskProjects";
import { TasksHomePage } from "@/components/tasks/TasksHomePage";

export const dynamic = "force-dynamic";

export default async function TasksIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [projects, todayCount, upcomingCount, overdueCount] = await Promise.all([
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
  ]);

  return (
    <TasksHomePage
      projects={projects}
      todayCount={todayCount}
      upcomingCount={upcomingCount}
      overdueCount={overdueCount}
    />
  );
}
