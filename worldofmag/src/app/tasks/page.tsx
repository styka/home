import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { getTaskProjects } from "@/modules/tasks/actions/taskProjects";
import { userDayBounds } from "@/lib/userTime";
import { TasksHomePage } from "@/modules/tasks/ui/TasksHomePage";

export const dynamic = "force-dynamic";

export default async function TasksIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const { start: todayStart, end: todayEnd } = userDayBounds();

  const [projects, todayCount, upcomingCount, overdueCount, todayTasks, ostatnieZadanie] = await Promise.all([
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
    /**
     * 105 (AC-2): projekt, do którego widget szybkiego dodawania ma celować domyślnie.
     *
     * Świadomie NIE zapisujemy „ostatnio używanego projektu" nigdzie — baza już to wie. Osobna
     * kolumna albo wpis w przeglądarce byłyby trzecim nośnikiem tego samego faktu i rozjechałyby
     * się przy pierwszym zadaniu dodanym przez asystenta.
     *
     * `findFirst`, nie `findMany` — interesuje nas jeden rekord, więc nie ma czego stronicować.
     */
    prisma.task.findFirst({
      where: { createdById: userId, projectId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { projectId: true },
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
      ostatniProjektId={ostatnieZadanie?.projectId ?? null}
    />
  );
}
