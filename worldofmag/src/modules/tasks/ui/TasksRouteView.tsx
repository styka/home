import { notFound } from "next/navigation";
import { getTasks, getTodayTasks, getOverdueTasks, getAllUserTasks, getTasksForProjects } from "../actions/tasks";
import { getTaskProjects } from "../actions/taskProjects";
import { getProjectAreas, type ObszarDTO } from "../actions/obszary";
import { getTaskTags } from "../actions/taskTags";
import { getProjectGroup } from "../actions/projectGroups";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { userTomorrowStart } from "@/lib/userTime";
import { TasksPage } from "./TasksPage";
import type { Task, ViewMode } from "@/types";
import { parseStatusConfig, aggregateStatusConfig } from "@/types";

/**
 * 080 (Z3): JEDEN widok listy zadań dla wszystkich zakresów.
 *
 * Wcześniej widok projektu i widok zestawu projektów żyły w tej samej trasie, ale zakres liczyły
 * z dwóch różnych źródeł — segmentu ścieżki albo parametrów zapytania. Właściciel zauważył przy
 * okazji, że „nawet ikony w górnym pasku są trochę inne i nie wiem dlaczego": różnice brały się
 * stąd, że część danych (konfiguracja statusów, możliwość edycji) liczyła się inaczej w każdej
 * gałęzi. Teraz jest jedna funkcja, więc oba widoki różnią się WYŁĄCZNIE zakresem i nazwą.
 */

export const VIRTUAL_VIEWS = ["today", "upcoming", "overdue", "all"] as const;
type VirtualView = (typeof VIRTUAL_VIEWS)[number];

const VIRTUAL_LABELS: Record<VirtualView, string> = {
  today: "📅 Dziś",
  upcoming: "📆 Nadchodzące",
  overdue: "⚠️ Zaległe",
  all: "◎ Wszystkie zadania",
};

/** Projekt w zakresie widoku wielu projektów (do scalania konfiguracji statusów). */
type ScopeProject = { id: string; name: string; emoji: string; isInbox: boolean };

export interface TasksRouteViewProps {
  /** Id projektu albo nazwa widoku wirtualnego. Puste, gdy oglądamy zapisany zestaw. */
  projectId: string;
  /** Id zapisanego zestawu projektów — z SEGMENTU ŚCIEŻKI, nie z parametrów zapytania. */
  zestawId?: string;
  searchParams?: Record<string, string | undefined>;
}

export async function TasksRouteView({ projectId, zestawId, searchParams }: TasksRouteViewProps) {
  // Sesja jest już sprawdzona przez trasę i przez `layout.tsx` (kontrola uprawnienia modułu),
  // ale potrzebujemy jej tu do zapytania o współdzielących i do flagi administratora.
  const session = await auth();
  if (!session?.user?.id) notFound();

  // Wejście z asystenta/linka: ?task=… otwiera szczegóły. Parametr ?status=… ustawiający filtr
  // czyta i waliduje teraz `useViewState` po stronie klienta (043) — dzięki temu działa też dla
  // WŁASNYCH statusów listy, których serwerowa lista `TASK_STATUS_FILTERS` nie zna.
  const initialOpenTaskId = searchParams?.task;
  const isVirtual = VIRTUAL_VIEWS.includes(projectId as VirtualView);

  const [allProjects, allTags] = await Promise.all([
    getTaskProjects(),
    getTaskTags(),
  ]);

  if (!isVirtual && !zestawId) {
    const project = allProjects.find((p) => p.id === projectId);
    if (!project) notFound();
  }

  let tasks: Task[];
  let viewMode: ViewMode;
  let projectName: string;
  // Widok wielu projektów: projekty w zakresie (konfiguracja statusów) + pełne dane zestawu
  // dla filtra (122: dropdown jest jedynym miejscem pokazywania i edycji zakresu).
  let scopeProjects: ScopeProject[] = [];
  let zestaw: { id: string; name: string; emoji: string; color: string | null; projectIds: string[] } | undefined;
  let areas: ObszarDTO[] = [];

  if (projectId === "today") {
    tasks = await getTodayTasks();
    viewMode = "today";
    projectName = VIRTUAL_LABELS.today;
  } else if (projectId === "overdue") {
    tasks = await getOverdueTasks();
    viewMode = "overdue";
    projectName = VIRTUAL_LABELS.overdue;
  } else if (projectId === "upcoming") {
    const tomorrow = userTomorrowStart();
    tasks = (await getAllUserTasks()).filter(
      (t) => t.dueDate && new Date(t.dueDate) >= tomorrow && t.status !== "DONE" && t.status !== "CANCELLED"
    );
    viewMode = "upcoming";
    projectName = VIRTUAL_LABELS.upcoming;
  } else if (projectId === "all") {
    tasks = await getAllUserTasks();
    viewMode = "all";
    projectName = VIRTUAL_LABELS.all;
  } else if (zestawId) {
    // 080 (Z3): ZAKRES POCHODZI Z SEGMENTU ŚCIEŻKI, nigdy z parametrów zapytania.
    //
    // To jest naprawa zgłoszenia „gdy zmienimy jakiemuś zadaniu status, to naraz z widoku znikają
    // projekty, jakby grupa projektów była pusta". Wcześniej zakres liczył się wyłącznie
    // z `searchParams` (?group= / ?projects=), a te potrafią nie dotrzeć przy ponownym renderze
    // wywołanym przez `revalidatePath` z akcji — stan widoku zapisujemy natywnym `pushState`
    // (`useViewState`, 043), więc adres i drzewo routera mogą się rozjechać. Pusty parametr dawał
    // `scopeIds = []`, czyli zero zadań i nagłówek „🗂 Wiele projektów (0)" — dokładnie ten tekst
    // zgłosił właściciel.
    //
    // Pozostałe filtry cierpiały tak samo, tylko nikt tego nie zgłosił: `oneOf(allowed, fallback)`
    // degraduje je do wartości domyślnej, czyli NIESZKODLIWIE. Zakres jako jedyny miał domyślną
    // „nic". Stąd reguła, która z tego wynika i obowiązuje dalej: żadne źródło zakresu nie może
    // degradować do zera zasobów.
    const group = await getProjectGroup(zestawId);
    if (!group) notFound();
    const scopeIds = group.projectIds;
    zestaw = { id: group.id, name: group.name, emoji: group.emoji, color: group.color, projectIds: scopeIds };
    projectName = `${group.emoji} ${group.name}`;
    tasks = await getTasksForProjects(scopeIds);
    viewMode = "multi";
    // Zachowaj kolejność z zakresu (scala się z niej konfigurację statusów).
    scopeProjects = scopeIds
      .map((id) => allProjects.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, isInbox: p.isInbox }));
  } else {
    tasks = await getTasks(projectId);
    const project = allProjects.find((p) => p.id === projectId)!;
    viewMode = "project";
    projectName = project.isInbox ? "📥 Skrzynka" : `${project.emoji} ${project.name}`;
    // 117: drzewo obszarów należy do projektu — widoki wirtualne/zestawy go nie mają.
    areas = await getProjectAreas(projectId);
  }

  const inbox = allProjects.find((p) => p.isInbox);
  const inboxId = inbox?.id ?? "";

  // Konfiguracja statusów. Realny projekt → jego własna konfiguracja (z edycją).
  // Widok zbiorczy (Wszystkie/Dziś/Nadchodzące/Zaległe/Grupy) → konfiguracja scalona
  // z list w zakresie, by zadania z własnymi statusami miały zakładkę i etykiety; bez edycji.
  const currentProject = isVirtual || zestawId ? null : allProjects.find((p) => p.id === projectId) ?? null;
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
      initialOpenTaskId={initialOpenTaskId}
      statusConfig={statusConfig}
      canEditStatuses={canEditStatuses}
      isAdmin={hasPermission(session, PERMISSIONS.ADMIN)}
      zestaw={zestaw}
      areas={areas}
      viewParams={searchParams ?? {}}
    />
  );
}
