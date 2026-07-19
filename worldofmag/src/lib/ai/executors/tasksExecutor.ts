// Z-010: handler akcji asystenta dla modułu Zadania (zadania + projekty).
// Scala oba dawne bloki `module === "tasks"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { createTask, updateTask, deleteTask, updateTaskTags, addTaskComment } from "@/actions/tasks";
import { createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import { createTaskTag } from "@/actions/taskTags";
import { createProjectGroup, updateProjectGroup, deleteProjectGroup } from "@/actions/projectGroups";
import { addDays, shiftPriority, asStr, undoAction, resolveTaskId, resolveProjectIdForCreate, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";
import type { TaskStatus, TaskPriority } from "@/types";

// Zamień listę NAZW etykiet na ich id (tworzy brakujące — createTaskTag jest upsertem
// po znormalizowanej nazwie). Puste/nietekstowe wpisy pomijamy.
async function resolveTaskTagIds(names: unknown): Promise<string[]> {
  const list = Array.isArray(names) ? names.map((n) => asStr(n)).filter((n): n is string => !!n) : [];
  const ids: string[] = [];
  for (const name of list) {
    const tag = await createTaskTag(name);
    ids.push(tag.id);
  }
  return ids;
}

export async function executeTasksAction(action: AIAction, userId: string, currentProjectId?: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_task") {
    const title = asStr(params.title) ?? "Nowe zadanie";
    const priority = (asStr(params.priority) ?? "NONE") as TaskPriority;
    const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;
    const projectId = await resolveProjectIdForCreate(userId, asStr(params.projectName), currentProjectId);
    // Podzadanie: gdy podano rodzica (id lub nazwa) — podepnij pod niego.
    let parentTaskId: string | null = null;
    if (params.parentTaskId || params.parentSearch) {
      parentTaskId = await resolveTaskId(userId, { taskId: params.parentTaskId }, asStr(params.parentSearch));
    }
    const tagIds = params.tags ? await resolveTaskTagIds(params.tags) : undefined;
    const task = await createTask({
      title,
      priority,
      dueDate,
      description: asStr(params.description) ?? null,
      projectId,
      ...(parentTaskId ? { parentTaskId } : {}),
      ...(tagIds && tagIds.length ? { tagIds } : {}),
    });
    const msg = `Utworzono zadanie "${task.title}"`;
    const undo = undoAction("tasks", "delete_task", { taskId: task.id }, `Usuń zadanie "${task.title}"`);
    if (params.openAfter === true) {
      const view = task.projectId ?? "all";
      return { message: msg, undo, navigateTo: `/tasks/${view}?task=${task.id}`, navigateLabel: `Otwórz „${task.title}”` };
    }
    return { message: msg, undo };
  }

  if (type === "update_task") {
    const id = await resolveTaskId(userId, params, searchQuery);
    const before = await prisma.task.findUnique({ where: { id }, select: { title: true, description: true, priority: true, status: true, dueDate: true } });
    const patch: Parameters<typeof updateTask>[1] = {};
    const undoParams: Record<string, unknown> = { taskId: id };
    if (params.title !== undefined) { patch.title = String(params.title); undoParams.title = before?.title ?? ""; }
    if (params.description !== undefined) { patch.description = asStr(params.description) ?? null; undoParams.description = before?.description ?? null; }
    if (params.priority !== undefined) { patch.priority = String(params.priority) as TaskPriority; undoParams.priority = before?.priority; }
    if (params.status !== undefined) { patch.status = String(params.status) as TaskStatus; undoParams.status = before?.status; }
    if (params.dueDate !== undefined) { patch.dueDate = params.dueDate ? new Date(String(params.dueDate)) : null; undoParams.dueDate = before?.dueDate?.toISOString() ?? null; }
    const task = await updateTask(id, patch);
    const undo = before
      ? { ...undoAction("tasks", "update_task", undoParams, `Cofnij zmiany w zadaniu "${task.title}"`), searchQuery: task.title }
      : undefined;
    return { message: `Zaktualizowano zadanie "${task.title}"`, undo };
  }

  if (type === "update_task_status") {
    const id = await resolveTaskId(userId, params, searchQuery);
    const status = (asStr(params.status) ?? "DONE") as TaskStatus;
    const before = await prisma.task.findUnique({ where: { id }, select: { status: true } });
    const task = await updateTask(id, { status });
    const undo = before
      ? { ...undoAction("tasks", "update_task_status", { taskId: id, status: before.status }, `Przywróć status "${task.title}" → ${before.status}`), searchQuery: task.title }
      : undefined;
    return { message: `Zmieniono status "${task.title}" → ${status}`, undo };
  }

  if (type === "shift_task_due_date") {
    const id = await resolveTaskId(userId, params, searchQuery, { notDone: true });
    const days = Number(params.days ?? 0);
    const existing = await prisma.task.findUnique({ where: { id }, select: { dueDate: true } });
    const newDate = addDays(existing?.dueDate ?? new Date(), days);
    const task = await updateTask(id, { dueDate: newDate });
    // Cofnięcie = przesunięcie o przeciwną liczbę dni (od nowego terminu wróci na stary).
    const undo = { ...undoAction("tasks", "shift_task_due_date", { taskId: id, days: -days }, `Cofnij przesunięcie terminu "${task.title}"`), searchQuery: task.title };
    return { message: `Przesunięto termin "${task.title}" o ${days > 0 ? "+" : ""}${days} dni`, undo };
  }

  if (type === "shift_task_priority") {
    const id = await resolveTaskId(userId, params, searchQuery);
    const steps = Math.trunc(Number(params.steps ?? 1)) || 0;
    const before = await prisma.task.findUnique({ where: { id }, select: { priority: true } });
    const current = (before?.priority ?? "NONE") as TaskPriority;
    const next = shiftPriority(current, steps);
    const task = await updateTask(id, { priority: next });
    // Cofnięcie ustawia z powrotem dokładną wartość sprzed zmiany (klamp mógł ją „zjeść").
    const undo = before
      ? { ...undoAction("tasks", "update_task", { taskId: id, priority: current }, `Przywróć priorytet "${task.title}" → ${current}`), searchQuery: task.title }
      : undefined;
    const msg = next === current
      ? `Priorytet "${task.title}" bez zmian (${current})`
      : `Zmieniono priorytet "${task.title}": ${current} → ${next}`;
    return { message: msg, undo };
  }

  if (type === "delete_task") {
    const id = await resolveTaskId(userId, params, searchQuery);
    const existing = await prisma.task.findUnique({ where: { id }, select: { title: true } });
    await deleteTask(id);
    return `Usunięto zadanie "${existing?.title ?? ""}"`;
  }

  if (type === "add_task_comment") {
    const id = await resolveTaskId(userId, params, searchQuery);
    const content = asStr(params.content) ?? asStr(params.comment);
    if (!content) throw new Error("Podaj treść komentarza");
    await addTaskComment(id, content);
    return `Dodano komentarz do zadania`;
  }

  if (type === "set_task_tags") {
    const id = await resolveTaskId(userId, params, searchQuery);
    const current = await prisma.task.findUnique({
      where: { id },
      select: { title: true, tags: { select: { tagId: true, tag: { select: { name: true } } } } },
    });
    const addIds = await resolveTaskTagIds(params.tags);
    const removeNames = (Array.isArray(params.removeTags) ? params.removeTags : [])
      .map((n) => asStr(n)?.toLowerCase())
      .filter((n): n is string => !!n);
    let finalIds: string[];
    if (params.replace === true) {
      finalIds = addIds; // pełne zastąpienie zestawu tagów
    } else {
      // Domyślnie DODAJEMY do istniejących (a removeTags zdejmuje wskazane).
      const existingIds = (current?.tags ?? [])
        .filter((t) => !removeNames.includes(t.tag.name.toLowerCase()))
        .map((t) => t.tagId);
      finalIds = Array.from(new Set([...existingIds, ...addIds]));
    }
    await updateTaskTags(id, finalIds);
    const label = current?.title ?? "";
    return `Zaktualizowano tagi zadania "${label}"`;
  }

  if (type === "create_project") {
    const name = asStr(params.name) ?? "Nowy projekt";
    const project = await createTaskProject(name, { emoji: asStr(params.emoji) });
    const msg = `Utworzono projekt "${project.name}"`;
    const undo = undoAction("tasks", "delete_project", { projectId: project.id }, `Usuń projekt "${project.name}"`);
    if (params.openAfter === true) {
      return { message: msg, undo, navigateTo: `/tasks/${project.id}`, navigateLabel: `Otwórz „${project.name}”` };
    }
    return { message: msg, undo };
  }

  const resolveProject = async () => {
    const projOr = [{ ownerId: userId }, { members: { some: { userId } } }];
    const id = asStr(params.projectId);
    if (id) { const p = await prisma.taskProject.findFirst({ where: { OR: projOr, id } }); if (p) return p.id; }
    const q = searchQuery ?? asStr(params.name) ?? "";
    const p = await prisma.taskProject.findFirst({ where: { OR: projOr, name: { contains: q, mode: "insensitive" } } });
    if (!p) throw new Error(`Nie znaleziono projektu: "${q}"`);
    return p.id;
  };
  if (type === "update_project") {
    const id = await resolveProject();
    await updateTaskProject(id, { name: asStr(params.name), emoji: asStr(params.emoji), description: asStr(params.description) });
    return `Zaktualizowano projekt`;
  }
  if (type === "delete_project") {
    const id = await resolveProject();
    const meta = await prisma.taskProject.findUnique({ where: { id }, select: { name: true, _count: { select: { tasks: true } } } });
    await deleteTaskProject(id);
    const n = meta?._count.tasks ?? 0;
    return n > 0
      ? `Usunięto projekt "${meta?.name ?? ""}" wraz z ${n} ${n === 1 ? "zadaniem" : "zadaniami"}`
      : `Usunięto pusty projekt "${meta?.name ?? ""}"`;
  }

  // Grupy projektów (foldery/współdzielony widok wieloprojektowy).
  async function resolveProjectIdsByNames(names: unknown): Promise<string[]> {
    const list = Array.isArray(names) ? names.map((n) => asStr(n)).filter((n): n is string => !!n) : [];
    const ids: string[] = [];
    for (const name of list) {
      const p = await prisma.taskProject.findFirst({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }], name: { contains: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (p) ids.push(p.id);
    }
    return ids;
  }
  if (type === "create_project_group") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę grupy projektów");
    const projectIds = await resolveProjectIdsByNames(params.projectNames);
    const group = await createProjectGroup({ name, projectIds, emoji: asStr(params.emoji), color: asStr(params.color) ?? null });
    return `Utworzono grupę projektów „${group.name}"`;
  }
  if (type === "update_project_group" || type === "delete_project_group") {
    // ProjectGroup jest user-only (ownerId, bez zespołu) — resolwujemy bez ownerOr.
    const q = searchQuery ?? asStr(params.name);
    const gid = asStr(params.groupId);
    const grp = gid
      ? await prisma.projectGroup.findFirst({ where: { id: gid, ownerId: userId }, select: { id: true } })
      : await prisma.projectGroup.findFirst({ where: { ownerId: userId, name: { contains: q ?? "", mode: "insensitive" } }, select: { id: true } });
    if (!grp) throw new Error(`Nie znaleziono grupy projektów: „${q ?? gid ?? ""}"`);
    const id = grp.id;
    if (type === "delete_project_group") { await deleteProjectGroup(id); return `Usunięto grupę projektów`; }
    const patch: Parameters<typeof updateProjectGroup>[1] = {};
    if (params.name !== undefined) patch.name = String(params.name);
    if (params.emoji !== undefined) patch.emoji = asStr(params.emoji);
    if (params.color !== undefined) patch.color = asStr(params.color) ?? null;
    if (params.projectNames !== undefined) patch.projectIds = await resolveProjectIdsByNames(params.projectNames);
    await updateProjectGroup(id, patch);
    return `Zaktualizowano grupę projektów`;
  }

  throw new Error(`Nieznany typ akcji zadań: ${type}`);
}
