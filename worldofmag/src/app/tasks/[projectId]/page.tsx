import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTasks, getTodayTasks, getOverdueTasks, getAllUserTasks } from "@/actions/tasks";
import { getTaskProjects } from "@/actions/taskProjects";
import { getTaskTags } from "@/actions/taskTags";
import { prisma } from "@/lib/prisma";
import { TasksPage } from "@/components/tasks/TasksPage";
import type { Task, ViewMode } from "@/types";

export const dynamic = "force-dynamic";

const VIRTUAL_VIEWS = ["today", "upcoming", "overdue", "all"] as const;
type VirtualView = typeof VIRTUAL_VIEWS[number];

const VIRTUAL_LABELS: Record<VirtualView, string> = {
  today: "📅 Dziś",
  upcoming: "📆 Nadchodzące",
  overdue: "⚠️ Zaległe",
  all: "◎ Wszystkie zadania",
};

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
  let viewMode: ViewMode;
  let projectName: string;

  if (projectId === "today") {
    tasks = await getTodayTasks();
    viewMode = "today";
    projectName = VIRTUAL_LABELS.today;
  } else if (projectId === "overdue") {
    tasks = await getOverdueTasks();
    viewMode = "overdue";
    projectName = VIRTUAL_LABELS.overdue;
  } else if (projectId === "upcoming") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    tasks = (await getAllUserTasks()).filter(
      (t) => t.dueDate && new Date(t.dueDate) >= tomorrow && t.status !== "DONE" && t.status !== "CANCELLED"
    );
    viewMode = "upcoming";
    projectName = VIRTUAL_LABELS.upcoming;
  } else if (projectId === "all") {
    tasks = await getAllUserTasks();
    viewMode = "all";
    projectName = VIRTUAL_LABELS.all;
  } else {
    tasks = await getTasks(projectId);
    const project = allProjects.find((p) => p.id === projectId)!;
    viewMode = "project";
    projectName = project.isInbox ? "📥 Skrzynka" : `${project.emoji} ${project.name}`;
  }

  const inbox = allProjects.find((p) => p.isInbox);
  const inboxId = inbox?.id ?? "";

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
      allProjects={allProjects}
      allTags={allTags}
      projectId={projectId}
      inboxId={inboxId}
      viewMode={viewMode}
      projectName={projectName}
      teamMembers={teamMembers.map((m: TeamMemberRow) => m.user)}
    />
  );
}
