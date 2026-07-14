// Z-010: handler akcji asystenta dla modułu Zadania (zadania + projekty).
// Scala oba dawne bloki `module === "tasks"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { createTask, updateTask, deleteTask } from "@/actions/tasks";
import { createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import { addDays, shiftPriority, asStr, undoAction, resolveTaskId, resolveProjectIdForCreate, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";
import type { TaskStatus, TaskPriority } from "@/types";

export async function executeTasksAction(action: AIAction, userId: string, currentProjectId?: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_task") {
    const title = asStr(params.title) ?? "Nowe zadanie";
    const priority = (asStr(params.priority) ?? "NONE") as TaskPriority;
    const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;
    const projectId = await resolveProjectIdForCreate(userId, asStr(params.projectName), currentProjectId);
    const task = await createTask({
      title,
      priority,
      dueDate,
      description: asStr(params.description) ?? null,
      projectId,
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

  throw new Error(`Nieznany typ akcji zadań: ${type}`);
}
