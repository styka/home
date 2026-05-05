import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTasks, getTodayTasks, getOverdueTasks, getAllUserTasks } from "@/actions/tasks";
import { getTaskProjects } from "@/actions/taskProjects";
import { getTaskTags } from "@/actions/taskTags";
import { prisma } from "@/lib/prisma";
import { TasksPage } from "@/components/tasks/TasksPage";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

const VIRTUAL_VIEWS = ["today", "upcoming", "overdue"] as const;
type VirtualView = typeof VIRTUAL_VIEWS[number];

interface Props {
  params: { projectId: string };
}

export default async function TaskProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { projectId } = params;
  const isVirtual = VIRTUAL_VIEWS.includes(projectId as VirtualView);

  const [allProjects, allTags] = await Promise.all([
    getTaskProjects(),
    getTaskTags(),
  ]);

  if (!isVirtual) {
    const project = allProjects.find((p) => p.id === projectId);
    if (!project) notFound();
  }

  let tasks: Task[];
  if (projectId === "today") {
    tasks = await getTodayTasks();
  } else if (projectId === "overdue") {
    tasks = await getOverdueTasks();
  } else if (projectId === "upcoming") {
    tasks = await getAllUserTasks().then((all) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return all.filter((t) => t.dueDate && new Date(t.dueDate) >= tomorrow && t.status !== "DONE" && t.status !== "CANCELLED");
    });
  } else {
    tasks = await getTasks(projectId);
  }

  const currentProject = allProjects.find((p) => p.id === projectId) ?? null;

  type TeamMemberRow = { user: { id: string; name: string | null; email: string | null; image: string | null } };
  const teamMembers = await prisma.teamMember
    .findMany({
      where: { team: { ownerId: session.user.id } },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    })
    .catch(() => [] as TeamMemberRow[]);

  return (
    <TasksPage
      tasks={tasks}
      currentProject={currentProject}
      allProjects={allProjects}
      allTags={allTags}
      projectId={projectId}
      teamMembers={teamMembers.map((m: TeamMemberRow) => m.user)}
    />
  );
}
