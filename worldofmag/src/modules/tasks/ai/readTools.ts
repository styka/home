import { getProjectGroups, getTaskTags } from "../contract";
import { technicalToLabel } from "@/platform/ai/humanize";
import { describeRecurringRule, parseRecurringRule } from "@/lib/recurrence";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis"
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, clampLimit, asStr, resolveIdOrName, resolveProjectRef } from "@/lib/ai/readToolShared";
// 052 (rozdz. 9.6): zakres list i sprawdzanie pojedynczego zasobu pochodzą z JEDNEGO miejsca
// w module — inaczej lista i guard rozjadą się przy pierwszej zmianie reguły.
import { accessibleProjectIds, requireTaskModuleAccess } from "../lib/sharingGuard";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_projects: args {} → [{ id, name, isInbox, taskCount }]",
  "- list_tasks: args { projectId?, status?, priority?, search?, tag?, dueBefore?, limit? } → [{ id, title, status, priority, dueDate, projectId, projectName, tags, recurring?, hasDescription? }]. projectId może być identyfikatorem ALBO nazwą projektu (dopasowanie bez rozróżniania wielkości liter) — gdy użytkownik nazwie projekt (np. „z projektu LZ\"), podaj tę nazwę wprost. Domyślnie pomija zadania DONE/CANCELLED (chyba że podasz status). dueBefore w ISO. tag = nazwa etykiety (bez rozróżniania wielkości liter) — użyj go, gdy użytkownik pyta „zadania otagowane/z tagiem X\". \"tags\" w wyniku to lista nazw etykiet danego zadania. recurring:true = zadanie CYKLICZNE (powtarzalne; szczegóły reguły przez get_task); hasDescription:true = zadanie ma niepusty opis (warto pobrać przez get_task, gdy potrzebujesz treści).",
  "- get_task: args { taskId? | search? } → { id, title, description, status, priority, dueDate, projectName, recurring? } | null. PEŁNY opis jednego zadania — wywołaj PRZED edycją opisu (update_task), gdy potrzebujesz aktualnej treści. recurring = opis reguły cykliczności po polsku (np. \"co tydzień: pon, śr\"), obecny tylko dla zadań cyklicznych.",
  "- list_task_tags: args {} → [{ id, name }]. Dostępne etykiety zadań (użyj, by podać istniejące tagi lub przed set_task_tags).",
  "- list_project_groups: args {} → [{ id, name, projectCount }]. Grupy projektów zadań (foldery/współdzielone widoki).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_projects: async (args, userId) => {
      const projects = await prisma.taskProject.findMany({
        where: { OR: [await filtrMoichRekordow(userId), { members: { some: { userId } } }] },
        include: { _count: { select: { tasks: true } } },
        orderBy: [{ isInbox: "desc" }, { createdAt: "asc" }],
        take: HARD_MAX,
      });
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        isInbox: p.isInbox,
        taskCount: p._count.tasks,
      }));
  },
  list_tasks: async (args, userId) => {
      const projectIds = await accessibleProjectIds(userId);
      const status = asStr(args.status);
      const priority = asStr(args.priority);
      const search = asStr(args.search);
      const dueBefore = asStr(args.dueBefore);
      const projectId = asStr(args.projectId);
      const tag = asStr(args.tag);

      const where: Record<string, unknown> = {
        parentTaskId: null,
        OR: [
          { projectId: { in: projectIds } },
          { createdById: userId },
          { assigneeId: userId },
        ],
      };
      // 025: `projectId` bywa NAZWĄ projektu ("LZ"), nie identyfikatorem — rozwiąż na
      // realne id. Nierozwiązany ref → błąd (łapany przez wołającego → agent dopytuje),
      // zamiast cicho zwrócić pustą listę i twierdzić „nie ma zadań".
      if (projectId) {
        const resolved = await resolveProjectRef(userId, projectId);
        if ("id" in resolved) where.projectId = resolved.id;
        else if (resolved.matches.length > 1) {
          // 032: „pasuje kilka” to inny problem niż „nie ma” — agent ma dopytać, a nie zgadywać.
          throw new Error(
            `Nazwa „${projectId}” pasuje do kilku projektów: ${resolved.matches.join(", ")}. Doprecyzuj, o który chodzi.`
          );
        } else {
          throw new Error(
            `Nie znaleziono projektu o nazwie „${projectId}”. Dostępne projekty: ${resolved.available.join(", ") || "(brak)"}. Doprecyzuj nazwę albo użyj list_projects.`
          );
        }
      }
      if (status) where.status = status;
      else where.status = { notIn: ["DONE", "CANCELLED"] };
      if (priority) where.priority = priority;
      if (search) where.title = { contains: search, mode: "insensitive" };
      // Filtr po tagu (nazwa etykiety, bez rozróżniania wielkości liter) — bez tego
      // agent nie umiał odpowiedzieć na „pokaż zadania otagowane X" i zapętlał się.
      if (tag) where.tags = { some: { tag: { name: { contains: tag, mode: "insensitive" } } } };
      if (dueBefore) {
        const d = new Date(dueBefore);
        if (!isNaN(d.getTime())) where.dueDate = { lte: d };
      }

      const tasks = await prisma.task.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          recurring: true,
          description: true,
          project: { select: { name: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { order: "asc" }],
        take: clampLimit(args.limit),
      });
      // 030: pola recurring/hasDescription tylko-gdy-ustawione — zero kosztu tokenów dla
      // zwykłych zadań, a model wie o cykliczności (nie halucynuje „aplikacja tego nie ma")
      // i wie, czy warto dociągać pełny opis przez get_task.
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        // 031: etykiety zamiast wartości technicznych — użytkownik widzi „Do zrobienia", nie „TODO".
        status: technicalToLabel(t.status),
        priority: technicalToLabel(t.priority),
        dueDate: t.dueDate?.toISOString() ?? null,
        projectId: t.projectId,
        projectName: t.project?.name ?? null,
        tags: t.tags.map((tt) => tt.tag.name),
        ...(t.recurring ? { recurring: true } : {}),
        ...(t.description?.trim() ? { hasDescription: true } : {}),
      }));
  },
  get_task: async (args, userId) => {
      const taskId = asStr(args.taskId);
      const search = asStr(args.search);
      const projectIds = await accessibleProjectIds(userId);
      const access = {
        OR: [
          { projectId: { in: projectIds } },
          { createdById: userId },
          { assigneeId: userId },
        ],
      };
      // 032: `taskId` bywa TYTUŁEM zadania, nie identyfikatorem — rozwiąż, zamiast cicho zwrócić null.
      const resolvedTaskId = taskId
        ? await resolveIdOrName(
            taskId,
            "zadania",
            async (id) => (await prisma.task.findFirst({ where: { id, ...access }, select: { id: true } }))?.id ?? null,
            async () =>
              (await prisma.task.findMany({ where: access, select: { id: true, title: true }, take: HARD_MAX })).map(
                (t) => ({ id: t.id, name: t.title })
              )
          )
        : undefined;
      // 052/AC-9: zanim cokolwiek zwrócimy, o dostęp pyta WSPÓLNY mechanizm — ten sam, który
      // decyduje przy zapisie. Zawężenie `access` niżej zostaje jako druga warstwa (obrona w głąb
      // dla wyszukiwania po tytule), ale to nie ono jest tu źródłem decyzji.
      if (resolvedTaskId) {
        await requireTaskModuleAccess(userId, { type: "tasks.task", id: resolvedTaskId }, "task.read");
      }
      const task = await prisma.task.findFirst({
        where: resolvedTaskId
          ? { id: resolvedTaskId, ...access }
          : { ...access, ...(search ? { title: { contains: search, mode: "insensitive" } } : {}) },
        select: {
          id: true, title: true, description: true, status: true,
          priority: true, dueDate: true, recurring: true, project: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!task) return null;
      const recurringLabel = describeRecurringRule(parseRecurringRule(task.recurring));
      return {
        id: task.id,
        title: task.title,
        description: task.description ?? "",
        status: technicalToLabel(task.status),
        priority: technicalToLabel(task.priority),
        dueDate: task.dueDate?.toISOString() ?? null,
        projectName: task.project?.name ?? null,
        ...(recurringLabel ? { recurring: recurringLabel } : {}),
      };
  },
  list_task_tags: async (args, userId) => {
      const tags = await getTaskTags();
      return tags.map((t) => ({ id: t.id, name: t.name }));
  },
  list_project_groups: async (args, userId) => {
      const groups = await getProjectGroups();
      return groups.map((g) => ({ id: g.id, name: g.name, projectCount: g.projectIds?.length ?? 0 }));
  },
};
