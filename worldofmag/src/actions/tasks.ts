"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { userDayBounds } from "@/lib/userTime";
import { assertProjectAccess } from "@/actions/taskProjects";
import { assertTaskAccess } from "@/lib/tasks/access";
import { trackActivity } from "@/actions/activity";
import { recordTrash } from "@/lib/trash";
import { computeNextDue, parseRecurringRule, computeRecurringSuccessor } from "@/lib/recurrence";
import type { Task, TaskPriority, TaskWithRelations, RecurringRule } from "@/types";
import { parseStatusConfig, DEFAULT_STATUS_CONFIG, SYSTEM_TASK_STATUSES } from "@/types";

const TASK_INCLUDE = {
  tags: { include: { tag: true } },
  subtasks: {
    include: { tags: { include: { tag: true } } },
    orderBy: { order: "asc" as const },
  },
  comments: {
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  shares: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      team: { select: { id: true, name: true } },
    },
  },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  project: { select: { id: true, name: true, emoji: true, isInbox: true, statusConfig: true } },
  _count: { select: { subtasks: true, comments: true } },
};

function toTask(p: unknown): Task {
  return p as Task;
}

export async function getTasks(projectId: string): Promise<Task[]> {
  const user = await requireAuth();
  await assertProjectAccess(projectId, user.id);

  const tasks = await prisma.task.findMany({
    where: { projectId, parentTaskId: null },
    include: TASK_INCLUDE,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return tasks.map(toTask);
}

/**
 * Zadania z kilku projektów naraz (widok „Wiele projektów”). Sprawdza dostęp do
 * każdego projektu osobno; nieprawidłowe / niedostępne id są pomijane (bez wyjątku),
 * żeby pojedynczy „martwy” id w linku nie wywalił całego widoku.
 */
export async function getTasksForProjects(projectIds: string[]): Promise<Task[]> {
  const user = await requireAuth();

  // Z-073: zamiast assertProjectAccess() per projekt (N+1 zapytań) — jedno
  // zapytanie filtrujące po tej samej regule dostępu co guard (właściciel LUB
  // członek). Wynik = dostępne ID; brak dostępu/nieistniejące po prostu odpadają.
  const allowedRows = await prisma.taskProject.findMany({
    where: {
      id: { in: projectIds },
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    select: { id: true },
  });
  const allowed = allowedRows.map((p) => p.id);
  if (allowed.length === 0) return [];

  const tasks = await prisma.task.findMany({
    where: { projectId: { in: allowed }, parentTaskId: null },
    include: TASK_INCLUDE,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return tasks.map(toTask);
}

export async function getAllUserTasks(): Promise<Task[]> {
  const user = await requireAuth();

  const projects = await prisma.taskProject.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });

  const projectIds = projects.map((p: { id: string }) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { projectId: { in: projectIds } },
        { createdById: user.id },
        { assigneeId: user.id },
      ],
      parentTaskId: null,
    },
    include: TASK_INCLUDE,
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { order: "asc" }],
  });

  return tasks.map(toTask);
}

export async function getTask(id: string): Promise<TaskWithRelations | null> {
  const user = await requireAuth();

  const task = await prisma.task.findUnique({
    where: { id },
    include: { ...TASK_INCLUDE, subtasks: { include: { tags: { include: { tag: true } }, _count: { select: { subtasks: true, comments: true } } }, orderBy: { order: "asc" } } },
  });

  if (!task) return null;
  await assertTaskAccess(task, user.id);

  return toTask(task) as TaskWithRelations;
}

export async function createTask(data: {
  title: string;
  projectId?: string | null;
  priority?: TaskPriority;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedMins?: number | null;
  description?: string | null;
  parentTaskId?: string | null;
  recurring?: RecurringRule | null;
  tagIds?: string[];
}): Promise<Task> {
  const user = await requireAuth();

  const title = data.title?.trim();
  if (!title) throw new Error("Tytuł zadania nie może być pusty");

  // Wirtualne widoki (today/upcoming/overdue/all) nie są projektami — traktuj jak brak projektu,
  // żeby przypadkowe przekazanie wirtualnego id nie wywaliło assertProjectAccess („Project not found").
  const VIRTUAL_VIEWS = ["today", "upcoming", "overdue", "all"];
  const projectId = data.projectId && !VIRTUAL_VIEWS.includes(data.projectId) ? data.projectId : null;
  if (projectId) await assertProjectAccess(projectId, user.id);

  // Odporność na nieprawidłowe daty z inputów (Invalid Date → null).
  const safeDate = (d: Date | null | undefined): Date | null => {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d as unknown as string);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const dueDate = safeDate(data.dueDate);

  const maxOrder = await prisma.task.aggregate({
    where: { projectId },
    _max: { order: true },
  });

  const task = await prisma.task.create({
    data: {
      title,
      projectId,
      priority: data.priority ?? "NONE",
      dueDate,
      startDate: safeDate(data.startDate),
      estimatedMins: data.estimatedMins ?? null,
      description: data.description ?? null,
      parentTaskId: data.parentTaskId ?? null,
      recurring: data.recurring ? JSON.stringify(data.recurring) : null,
      createdById: user.id,
      order: (maxOrder._max.order ?? 0) + 1,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  void trackActivity("tasks", "create_task", { title, priority: data.priority ?? "NONE", dueDate: dueDate?.toISOString() ?? null });
  revalidatePath("/tasks");
  if (projectId) revalidatePath(`/tasks/${projectId}`);
  return toTask(task);
}

/**
 * JEDYNE miejsce tworzenia następnego wystąpienia zadania cyklicznego. Wywoływane wyłącznie z
 * `updateTask` (przy prawdziwym przejściu → „zrobione"), więc efekt jest wymuszony centralnie i
 * identyczny niezależnie od wejścia (UI, operacje zbiorcze, asystent AI). Zwraca utworzone zadanie
 * albo `null`, gdy seria się skończyła.
 */
async function spawnRecurringSuccessor(
  existing: {
    id: string; title: string; description: string | null; priority: string;
    projectId: string | null; parentTaskId: string | null; estimatedMins: number | null;
    createdById: string | null; assigneeId: string | null; recurring: string | null;
    startDate: Date | null; dueDate: Date | null; order: number;
  },
  opts: { completedAt: Date; anchor?: "DUE" | "COMPLETION"; nextDueOverride?: string },
): Promise<Task | null> {
  const rule = parseRecurringRule(existing.recurring);
  if (!rule) return null;

  const dates = computeRecurringSuccessor(
    { recurring: rule, dueDate: existing.dueDate, startDate: existing.startDate, completedAt: opts.completedAt },
    { anchor: opts.anchor, nextDueOverride: opts.nextDueOverride },
  );
  if (!dates) return null;

  const tags = await prisma.taskTaskTag.findMany({ where: { taskId: existing.id }, select: { tagId: true } });

  const nextTask = await prisma.task.create({
    data: {
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      projectId: existing.projectId,
      parentTaskId: existing.parentTaskId,
      estimatedMins: existing.estimatedMins,
      createdById: existing.createdById,
      assigneeId: existing.assigneeId,
      recurring: existing.recurring,
      startDate: dates.nextStart,
      dueDate: dates.nextDue,
      // Kolejne wystąpienie niesie datę wykonania właśnie zamkniętego — żeby aktywne
      // zadanie cykliczne pokazywało „datę ostatniego wykonania" (020).
      lastCompletedAt: opts.completedAt,
      // 022: trwały link do domkniętego poprzednika — pozwala zsynchronizować „datę ostatniego
      // wykonania" następcy, gdy poprawimy datę zrobienia poprzednika.
      previousTaskId: existing.id,
      order: existing.order,
      ...(tags.length > 0 && { tags: { create: tags.map((t) => ({ tagId: t.tagId })) } }),
    },
    include: TASK_INCLUDE,
  });
  return toTask(nextTask);
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    status: string; // klucz statusu (systemowy lub własny — Task.status to String)
    priority: TaskPriority;
    dueDate: Date | null;
    startDate: Date | null;
    estimatedMins: number | null;
    projectId: string | null;
    assigneeId: string | null;
    recurring: RecurringRule | null;
    order: number;
    completedAt: Date | null; // jawna data wykonania — ma pierwszeństwo nad wyliczaną ze statusu
  }>,
  // Wewnętrzne odstępstwa jednorazowe przy domykaniu cyklicznego (anchor/override/data wykonania).
  // Przekazywane WYŁĄCZNIE przez wrapper `completeRecurringTask`; klienci wołają z 2 argumentami.
  internalOpts?: { recurring?: CompleteRecurringOptions },
): Promise<Task> {
  const user = await requireAuth();
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");
  await assertTaskAccess(existing, user.id);
  // Przeniesienie zadania do innego projektu — wymaga dostępu także do celu.
  if (patch.projectId) await assertProjectAccess(patch.projectId, user.id);

  // Przeniesienie do innego projektu: własne statusy są per-lista, więc status z klucza
  // custom, którego docelowy projekt nie zna, „osierociałby" (brak etykiety/zakładki).
  // Gdy zmiana statusu nie jest jawnie w patchu, resetuj taki status do pierwszego
  // włączonego statusu celu (statusy systemowe są uniwersalne i zostają bez zmian).
  if (patch.projectId && patch.projectId !== existing.projectId && patch.status === undefined) {
    const isSystemStatus = SYSTEM_TASK_STATUSES.some((s) => s.key === existing.status);
    if (!isSystemStatus) {
      const target = await prisma.taskProject.findUnique({ where: { id: patch.projectId }, select: { statusConfig: true } });
      const cfg = parseStatusConfig(target?.statusConfig ?? null);
      const known = new Set<string>([...SYSTEM_TASK_STATUSES.map((s) => s.key), ...(cfg.custom ?? []).map((c) => c.key)]);
      if (!known.has(existing.status)) {
        patch = { ...patch, status: cfg.enabled[0] ?? "TODO" };
      }
    }
  }

  // Data wykonania wyliczana ze zmiany statusu (→DONE = teraz; →inny = wyczyść).
  const derivedCompletedAt =
    patch.status === "DONE" && existing.status !== "DONE"
      ? new Date()
      : patch.status && patch.status !== "DONE"
      ? null
      : undefined;
  // Jawnie podana data wykonania (edycja w szczegółach / oznaczanie z datą) MA PIERWSZEŃSTWO
  // nad wyliczoną ze statusu. `completedAt` NIE wchodzi przez `{ ...patch }` — ustawiamy jawnie.
  const { completedAt: explicitCompletedAt, ...restPatch } = patch;
  const finalCompletedAt = explicitCompletedAt !== undefined ? explicitCompletedAt : derivedCompletedAt;

  const data: Record<string, unknown> = { ...restPatch };
  if (patch.recurring !== undefined) {
    data.recurring = patch.recurring ? JSON.stringify(patch.recurring) : null;
  }
  if (finalCompletedAt !== undefined) data.completedAt = finalCompletedAt;
  if (patch.title) data.title = patch.title.trim();

  const task = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

  // 022: przy jawnej edycji daty wykonania zsynchronizuj „datę ostatniego wykonania"
  // następnego wystąpienia cyklicznego (powiązanego przez previousTaskId). `updateMany`
  // obsłuży 0 lub 1 następcę (brak następcy / niecykliczne → no-op).
  if (explicitCompletedAt !== undefined) {
    await prisma.task.updateMany({ where: { previousTaskId: id }, data: { lastCompletedAt: explicitCompletedAt } });

    // 023: dla kotwicy „od daty wykonania" (COMPLETION) termin następcy liczy się od daty
    // wykonania poprzednika — więc korekta tej daty musi przeliczyć termin (i przesunąć start)
    // AKTYWNEGO, nietkniętego następcy. „Nietknięty" = termin wciąż równy policzonemu ze starej
    // daty (nie ruszony ręcznie ani przez „Następne w tej dacie"). DUE / zrobiony następca /
    // niecykliczne → pomijamy (zmienia się tylko lastCompletedAt powyżej).
    const rule = parseRecurringRule(existing.recurring);
    if (rule?.anchor === "COMPLETION" && explicitCompletedAt !== null && existing.completedAt) {
      const successor = await prisma.task.findFirst({ where: { previousTaskId: id, status: { not: "DONE" } } });
      const oldNextDue = computeNextDue(existing.completedAt, rule);
      if (successor?.dueDate && oldNextDue && successor.dueDate.getTime() === oldNextDue.getTime()) {
        const newNextDue = computeNextDue(explicitCompletedAt, rule);
        if (newNextDue) {
          const succData: Record<string, unknown> = { dueDate: newNextDue };
          // Zachowaj wyprzedzenie startu względem terminu — przesuń o tę samą różnicę.
          if (successor.startDate) {
            succData.startDate = new Date(successor.startDate.getTime() + (newNextDue.getTime() - oldNextDue.getTime()));
          }
          await prisma.task.update({ where: { id: successor.id }, data: succData });
        }
      }
    }
  }

  // Wymuszenie centralne: PIERWSZE domknięcie zadania cyklicznego (z DOWOLNEGO wejścia — UI,
  // operacje zbiorcze, asystent AI) tworzy kolejne wystąpienie. Warunek „prawdziwego przejścia"
  // (`existing.status !== "DONE"`) oddziela pierwsze domknięcie (spawn) od późniejszej edycji daty
  // wykonania już-zrobionego zadania — tę obsługuje blok 022/023 wyżej (na istniejącym następcy),
  // więc obie ścieżki się nie dublują.
  if (patch.status === "DONE" && existing.status !== "DONE" && existing.recurring) {
    await spawnRecurringSuccessor(existing, {
      completedAt: finalCompletedAt ?? new Date(),
      anchor: internalOpts?.recurring?.anchor,
      nextDueOverride: internalOpts?.recurring?.nextDueOverride,
    });
  }

  void trackActivity("tasks", "update_task", { id, patchKeys: Object.keys(patch) });
  revalidatePath("/tasks");
  // Odśwież zarówno stary, jak i nowy projekt (przy przeniesieniu zadanie znika
  // ze starej listy i pojawia się na nowej).
  if (existing.projectId) revalidatePath(`/tasks/${existing.projectId}`);
  if (task.projectId && task.projectId !== existing.projectId) revalidatePath(`/tasks/${task.projectId}`);
  return toTask(task);
}

export async function updateTaskTags(taskId: string, tagIds: string[]): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  await assertTaskAccess(task, user.id);

  await prisma.taskTaskTag.deleteMany({ where: { taskId } });
  if (tagIds.length > 0) {
    await prisma.taskTaskTag.createMany({ data: tagIds.map((tagId) => ({ taskId, tagId })) });
  }

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function deleteTask(id: string): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id }, include: { tags: { select: { tagId: true } } } });
  if (!task) return;
  await assertTaskAccess(task, user.id);

  // H5: migawka do kosza (pola skalarne + tagi; podzadania/komentarze nie są odtwarzane).
  await recordTrash(user.id, {
    module: "tasks",
    entityId: task.id,
    title: task.title,
    payload: {
      id: task.id, title: task.title, description: task.description, status: task.status,
      priority: task.priority, dueDate: task.dueDate, startDate: task.startDate,
      completedAt: task.completedAt, estimatedMins: task.estimatedMins, recurring: task.recurring,
      category: task.category, order: task.order, projectId: task.projectId,
      parentTaskId: task.parentTaskId, createdById: task.createdById, assigneeId: task.assigneeId,
      createdAt: task.createdAt, tagIds: task.tags.map((t) => t.tagId),
    },
  });

  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

/**
 * Zbiorcza (bulkowa) edycja zaznaczonych zadań. Każde pole w `patch` jest opcjonalne —
 * ustawiamy TYLKO te, które przekazano; nietknięte pola zadań zostają bez zmian.
 * Tagi mają semantykę dodaj/usuń (`addTagIds`/`removeTagIds`) — pozostałe tagi zadania
 * są nietknięte. Zadania bez prawa edycji są POMIJANE (nie zmieniane), a wynik zwraca
 * liczniki `{ updated, skipped }` do komunikatu „zmieniono X z N".
 * Logika `completedAt` i normalizacji custom statusu przy przeniesieniu projektu jest
 * spójna z `updateTask` (patrz tam po uzasadnienie).
 */
export async function bulkUpdateTasks(
  taskIds: string[],
  patch: Partial<{
    status: string;
    priority: TaskPriority;
    dueDate: Date | null;
    category: string;
    projectId: string | null;
    addTagIds: string[];
    removeTagIds: string[];
    completedAt: Date | null; // wspólna data wykonania dla zaznaczonych (opcjonalna; dla „Zrobione")
  }>
): Promise<{ updated: number; skipped: number }> {
  const user = await requireAuth();
  if (taskIds.length === 0) return { updated: 0, skipped: 0 };

  // Przeniesienie do innego projektu wymaga dostępu także do celu (sprawdzane raz).
  if (patch.projectId) await assertProjectAccess(patch.projectId, user.id);

  const { addTagIds = [], removeTagIds = [], ...scalar } = patch;
  const affectedProjectIds = new Set<string>();
  let updated = 0;
  let skipped = 0;

  for (const id of taskIds) {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) { skipped++; continue; }
    // Brak dostępu = pomiń (nie rzucaj) — częściowy wynik jest zamierzony.
    try {
      await assertTaskAccess(existing, user.id);
    } catch {
      skipped++;
      continue;
    }

    const data: Record<string, unknown> = {};
    if (scalar.status !== undefined) data.status = scalar.status;
    if (scalar.priority !== undefined) data.priority = scalar.priority;
    if (scalar.dueDate !== undefined) data.dueDate = scalar.dueDate;
    if (scalar.category !== undefined) data.category = scalar.category;
    if (scalar.projectId !== undefined) data.projectId = scalar.projectId;

    // Przeniesienie do innego projektu bez jawnej zmiany statusu: custom status, którego
    // cel nie zna, „osierociałby" — zresetuj do pierwszego włączonego statusu celu.
    if (scalar.projectId && scalar.projectId !== existing.projectId && scalar.status === undefined) {
      const isSystemStatus = SYSTEM_TASK_STATUSES.some((s) => s.key === existing.status);
      if (!isSystemStatus) {
        const target = await prisma.taskProject.findUnique({ where: { id: scalar.projectId }, select: { statusConfig: true } });
        const cfg = parseStatusConfig(target?.statusConfig ?? null);
        const known = new Set<string>([...SYSTEM_TASK_STATUSES.map((s) => s.key), ...(cfg.custom ?? []).map((c) => c.key)]);
        if (!known.has(existing.status)) data.status = cfg.enabled[0] ?? "TODO";
      }
    }

    const newStatus = data.status as string | undefined;
    const isDoneTransition = newStatus === "DONE" && existing.status !== "DONE";

    if (isDoneTransition && existing.recurring) {
      // 022: cykliczne domykane masowo rolujemy jak pojedyncze odhaczenie (tworzy kolejne
      // wystąpienie), z opcjonalną wspólną datą wykonania (021). NIE surowy update — ten
      // ominąłby generację następnego wystąpienia.
      await completeRecurringTask(id, scalar.completedAt ? { completionDate: scalar.completedAt.toISOString() } : {});
      // Pozostałe pola skalarne (priorytet/kategoria/projekt) nałóż na domknięty rekord.
      delete data.status;
      if (Object.keys(data).length > 0) {
        await prisma.task.update({ where: { id }, data });
      }
    } else {
      // Przy masowym „Zrobione": wspólna podana data wykonania albo „teraz" (dotychczasowe zachowanie).
      if (isDoneTransition) data.completedAt = scalar.completedAt ?? new Date();
      else if (newStatus && newStatus !== "DONE") data.completedAt = null;

      if (Object.keys(data).length > 0) {
        await prisma.task.update({ where: { id }, data });
      }
    }

    // Tagi: usuń wybrane, potem dodaj wybrane (pozostałe tagi zadania nietknięte).
    if (removeTagIds.length > 0) {
      await prisma.taskTaskTag.deleteMany({ where: { taskId: id, tagId: { in: removeTagIds } } });
    }
    if (addTagIds.length > 0) {
      await prisma.taskTaskTag.createMany({ data: addTagIds.map((tagId) => ({ taskId: id, tagId })), skipDuplicates: true });
    }

    if (existing.projectId) affectedProjectIds.add(existing.projectId);
    if (scalar.projectId) affectedProjectIds.add(scalar.projectId);
    updated++;
  }

  void trackActivity("tasks", "bulk_update_tasks", { count: updated, skipped, patchKeys: Object.keys(patch) });
  revalidatePath("/tasks");
  Array.from(affectedProjectIds).forEach((pid) => revalidatePath(`/tasks/${pid}`));
  return { updated, skipped };
}

/**
 * Zbiorcze (bulkowe) usunięcie zaznaczonych zadań — soft-delete do Kosza (migawka jak w
 * `deleteTask`). Zadania bez prawa edycji są pomijane; zwraca `{ deleted, skipped }`.
 */
export async function bulkDeleteTasks(taskIds: string[]): Promise<{ deleted: number; skipped: number }> {
  const user = await requireAuth();
  if (taskIds.length === 0) return { deleted: 0, skipped: 0 };

  const affectedProjectIds = new Set<string>();
  let deleted = 0;
  let skipped = 0;

  for (const id of taskIds) {
    const task = await prisma.task.findUnique({ where: { id }, include: { tags: { select: { tagId: true } } } });
    if (!task) { skipped++; continue; }
    try {
      await assertTaskAccess(task, user.id);
    } catch {
      skipped++;
      continue;
    }

    await recordTrash(user.id, {
      module: "tasks",
      entityId: task.id,
      title: task.title,
      payload: {
        id: task.id, title: task.title, description: task.description, status: task.status,
        priority: task.priority, dueDate: task.dueDate, startDate: task.startDate,
        completedAt: task.completedAt, estimatedMins: task.estimatedMins, recurring: task.recurring,
        category: task.category, order: task.order, projectId: task.projectId,
        parentTaskId: task.parentTaskId, createdById: task.createdById, assigneeId: task.assigneeId,
        createdAt: task.createdAt, tagIds: task.tags.map((t) => t.tagId),
      },
    });
    await prisma.task.delete({ where: { id } });
    if (task.projectId) affectedProjectIds.add(task.projectId);
    deleted++;
  }

  void trackActivity("tasks", "bulk_delete_tasks", { count: deleted, skipped });
  revalidatePath("/tasks");
  Array.from(affectedProjectIds).forEach((pid) => revalidatePath(`/tasks/${pid}`));
  return { deleted, skipped };
}

export async function toggleTaskStatus(id: string): Promise<Task> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { statusConfig: true } } },
  });
  if (!task) throw new Error("Task not found");
  await assertTaskAccess(task, user.id);

  // Cykl po skonfigurowanej ścieżce projektu (przód). Domyślnie TODO→IN_PROGRESS→DONE.
  const { chain } = parseStatusConfig(task.project?.statusConfig ?? null);
  const cycle = chain.length ? chain : DEFAULT_STATUS_CONFIG.chain;
  const idx = cycle.indexOf(task.status);
  // Status spoza ścieżki (np. CANCELLED/DEFERRED) → wskakujemy na początek ścieżki.
  const next: string = idx === -1 ? cycle[0] : cycle[(idx + 1) % cycle.length];

  // `updateTask` wymusza centralnie utworzenie kolejnego wystąpienia przy przejściu → „zrobione"
  // zadania cyklicznego (patrz `spawnRecurringSuccessor`), więc nie ma tu już specjalnej ścieżki.
  return updateTask(id, { status: next });
}

/** Opcje jednorazowego odstępstwa przy zamykaniu cyklicznego zadania.
 * Wszystkie pola opcjonalne — bez nich zachowanie jest jak dotąd (wg reguły). */
export interface CompleteRecurringOptions {
  /** Nadpisz tryb liczenia następnego terminu TYLKO dla tego wykonania
   * (reguła zapisana w nowym zadaniu pozostaje bez zmian). */
  anchor?: "DUE" | "COMPLETION";
  /** Data wykonania (ISO) — zapisana jako completedAt zamykanego zadania i baza
   * dla trybu COMPLETION. Domyślnie „teraz". */
  completionDate?: string;
  /** Konkretny termin następnego wystąpienia (ISO) — pomija computeNextDue. */
  nextDueOverride?: string;
}

/**
 * Domknięcie zadania cyklicznego z opcjonalnym jednorazowym odstępstwem (anchor / data wykonania /
 * termin następnika). To **cienki wrapper** nad `updateTask` — jedynym miejscem tworzącym następcę
 * (patrz `spawnRecurringSuccessor`). Dzięki temu domknięcie z listy/skrótu, z panelu szczegółów,
 * masowe i przez asystenta AI dają identyczny wynik i nie ma ryzyka podwójnego następcy.
 * Zwraca utworzone następne wystąpienie (kontrakt historyczny), a gdy seria się skończyła —
 * zamknięte zadanie.
 */
export async function completeRecurringTask(
  id: string,
  opts: CompleteRecurringOptions = {},
): Promise<Task> {
  const completedAt = opts.completionDate ? new Date(opts.completionDate) : undefined;
  await updateTask(
    id,
    { status: "DONE", ...(completedAt !== undefined ? { completedAt } : {}) },
    { recurring: opts },
  );

  // Zwróć nowo utworzonego następcę (jeśli powstał) — zgodność z wcześniejszym kontraktem zwrotu.
  const successor = await prisma.task.findFirst({
    where: { previousTaskId: id },
    orderBy: { createdAt: "desc" },
    include: TASK_INCLUDE,
  });
  if (successor) return toTask(successor);

  const closed = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  if (!closed) throw new Error("Task not found");
  return toTask(closed);
}

export async function addTaskComment(taskId: string, content: string): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  await assertTaskAccess(task, user.id);

  await prisma.taskComment.create({ data: { taskId, userId: user.id, content: content.trim() } });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  const user = await requireAuth();
  const comment = await prisma.taskComment.findUnique({ where: { id: commentId }, include: { task: true } });
  if (!comment) return;
  if (comment.userId !== user.id) throw new Error("Not your comment");

  await prisma.taskComment.delete({ where: { id: commentId } });
  if (comment.task.projectId) revalidatePath(`/tasks/${comment.task.projectId}`);
}

export async function shareTask(taskId: string, target: { userId?: string; teamId?: string }, role: "VIEWER" | "EDITOR" = "VIEWER"): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  await assertTaskAccess(task, user.id);

  await prisma.taskShare.create({ data: { taskId, userId: target.userId ?? null, teamId: target.teamId ?? null, role } });
  if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
}

export async function removeTaskShare(shareId: string): Promise<void> {
  const user = await requireAuth();
  const share = await prisma.taskShare.findUnique({ where: { id: shareId }, include: { task: true } });
  if (!share) return;
  await assertTaskAccess(share.task, user.id);

  await prisma.taskShare.delete({ where: { id: shareId } });
  if (share.task.projectId) revalidatePath(`/tasks/${share.task.projectId}`);
}

export async function shareTaskByEmail(taskId: string, email: string, role: "VIEWER" | "EDITOR" = "VIEWER"): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Zadanie nie znalezione" };
    await assertTaskAccess(task, user.id);

    const targetUser = await prisma.user.findFirst({ where: { email } });
    if (!targetUser) return { error: "Użytkownik nie znaleziony" };

    const existing = await prisma.taskShare.findFirst({ where: { taskId, userId: targetUser.id } });
    if (existing) {
      await prisma.taskShare.update({ where: { id: existing.id }, data: { role } });
    } else {
      await prisma.taskShare.create({ data: { taskId, userId: targetUser.id, role } });
    }

    revalidatePath("/tasks");
    if (task.projectId) revalidatePath(`/tasks/${task.projectId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Błąd" };
  }
}

export async function reorderTask(taskId: string, newOrder: number): Promise<void> {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, createdById: true, assigneeId: true },
  });
  if (!task) throw new Error("Task not found");
  await assertTaskAccess(task, user.id);
  await prisma.task.update({ where: { id: taskId }, data: { order: newOrder } });
  revalidatePath("/tasks");
}

export async function getTodayTasks(): Promise<Task[]> {
  const user = await requireAuth();
  const { start, end } = userDayBounds();

  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { id: true },
  });
  const projectIds = projects.map((p: { id: string }) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ projectId: { in: projectIds } }, { assigneeId: user.id }],
      dueDate: { gte: start, lte: end },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    include: TASK_INCLUDE,
    orderBy: [{ priority: "asc" }, { order: "asc" }],
  });

  return tasks.map(toTask);
}

export async function getOverdueTasks(): Promise<Task[]> {
  const user = await requireAuth();
  const { start: now } = userDayBounds();

  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { id: true },
  });
  const projectIds = projects.map((p: { id: string }) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ projectId: { in: projectIds } }, { assigneeId: user.id }],
      dueDate: { lt: now },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    include: TASK_INCLUDE,
    orderBy: [{ dueDate: "asc" }],
  });

  return tasks.map(toTask);
}
