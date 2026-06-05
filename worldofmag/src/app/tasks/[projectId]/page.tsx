import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getTasks, getTodayTasks, getOverdueTasks, getAllUserTasks, getTasksForProjects } from "@/actions/tasks";
import { getTaskProjects } from "@/actions/taskProjects";
import { getTaskTags } from "@/actions/taskTags";
import { getProjectGroup } from "@/actions/projectGroups";
import { prisma } from "@/lib/prisma";
import { TasksPage } from "@/components/tasks/TasksPage";
import type { Task, ViewMode, TaskStatusFilter } from "@/types";
import { TASK_STATUS_FILTERS, parseStatusConfig, aggregateStatusConfig } from "@/types";

export const dynamic = "force-dynamic";

const VIRTUAL_VIEWS = ["today", "upcoming", "overdue", "all", "multi"] as const;
type VirtualView = typeof VIRTUAL_VIEWS[number];

const VIRTUAL_LABELS: Record<VirtualView, string> = {
  today: "📅 Dziś",
  upcoming: "📆 Nadchodzące",
  overdue: "⚠️ Zaległe",
  all: "◎ Wszystkie zadania",
  multi: "🗂 Wiele projektów",
};

interface Props {
  params: { projectId: string };
  searchParams?: { status?: string; task?: string; projects?: string; group?: string; view?: string };
}

/** Projekt w „pasku zakresu” widoku wielu projektów (chip pod nagłówkiem). */
type ScopeProject = { id: string; name: string; emoji: string; isInbox: boolean };

export default async function TaskProjectPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { projectId } = params;

  // Wejście z asystenta/linka: ?status=… ustawia filtr, ?task=… otwiera szczegóły.
  const statusParam = searchParams?.status;
  const initialFilter: TaskStatusFilter | undefined =
    statusParam && (TASK_STATUS_FILTERS as string[]).includes(statusParam)
      ? (statusParam as TaskStatusFilter)
      : undefined;
  const initialOpenTaskId = searchParams?.task;
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
  // Widok wielu projektów: lista projektów w zakresie + id zapisanej grupy (do edycji).
  let scopeProjects: ScopeProject[] = [];
  let multiGroupId: string | undefined;

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
  } else if (projectId === "multi") {
    // Dwa źródła zakresu: zapisana grupa (?group=<id>, alias wsteczny ?view=) lub doraźna lista (?projects=).
    let scopeIds: string[];
    const groupId = searchParams?.group ?? searchParams?.view;
    if (groupId) {
      const group = await getProjectGroup(groupId);
      if (!group) notFound();
      scopeIds = group.projectIds;
      multiGroupId = group.id;
      projectName = `${group.emoji} ${group.name}`;
    } else {
      const requestedIds = (searchParams?.projects ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      scopeIds = requestedIds.filter((id) => allProjects.some((p) => p.id === id));
      projectName = `🗂 Wiele projektów (${scopeIds.length})`;
    }
    tasks = await getTasksForProjects(scopeIds);
    viewMode = "multi";
    // Zachowaj kolejność z zakresu i opisz każdy projekt (chip pod nagłówkiem).
    scopeProjects = scopeIds
      .map((id) => allProjects.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, isInbox: p.isInbox }));
  } else {
    tasks = await getTasks(projectId);
    const project = allProjects.find((p) => p.id === projectId)!;
    viewMode = "project";
    projectName = project.isInbox ? "📥 Skrzynka" : `${project.emoji} ${project.name}`;
  }

  const inbox = allProjects.find((p) => p.isInbox);
  const inboxId = inbox?.id ?? "";

  // Konfiguracja statusów. Realny projekt → jego własna konfiguracja (z edycją).
  // Widok zbiorczy (Wszystkie/Dziś/Nadchodzące/Zaległe/Grupy) → konfiguracja scalona
  // z list w zakresie, by zadania z własnymi statusami miały zakładkę i etykiety; bez edycji.
  const currentProject = isVirtual ? null : allProjects.find((p) => p.id === projectId) ?? null;
  const canEditStatuses = !!currentProject;
  const scopeForStatuses =
    viewMode === "multi"
      ? scopeProjects
          .map((sp) => allProjects.find((p) => p.id === sp.id))
          .filter((p): p is NonNullable<typeof p> => !!p)
      : allProjects;
  const statusConfig = currentProject
    ? parseStatusConfig(currentProject.statusConfig)
    : aggregateStatusConfig(scopeForStatuses, tasks);

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
      initialFilter={initialFilter}
      initialOpenTaskId={initialOpenTaskId}
      statusConfig={statusConfig}
      canEditStatuses={canEditStatuses}
      isAdmin={hasPermission(session, PERMISSIONS.ADMIN)}
      scopeProjects={scopeProjects}
      multiGroupId={multiGroupId}
    />
  );
}
