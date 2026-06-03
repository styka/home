import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";

/**
 * Narzędzia ODCZYTU dla agenta „magicznej ikony". Każde narzędzie używa tych samych
 * filtrów dostępu co Server Actions w `src/actions/*` (własność użytkownika lub zespołu),
 * a zwraca ZWIĘZŁE kształty (id + kluczowe pola), żeby nie rozsadzić kontekstu LLM.
 *
 * Kluczowe: każdy wiersz ma `id` — agent wstawia je do parametrów akcji (taskId/itemId/…)
 * i dzięki temu akcje zbiorcze celują w konkretne rekordy, a nie w pierwszy pasujący po nazwie.
 */

const HARD_MAX = 60;
function clampLimit(n: unknown, def = 40): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : def;
  return Math.max(1, Math.min(HARD_MAX, Math.floor(v)));
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const READ_TOOLS_PROMPT = `Dostępne narzędzia ODCZYTU (step "query"). Wywołaj je, gdy potrzebujesz danych użytkownika, zanim odpowiesz lub zaproponujesz akcje. Każdy wiersz zawiera "id" — użyj go w parametrach akcji (taskId/itemId/noteId/listId/projectId/petId), aby celować w konkretne rekordy (akcje zbiorcze = wiele akcji, każda z własnym id).

- list_projects: args {} → [{ id, name, isInbox, taskCount }]
- list_tasks: args { projectId?, status?, priority?, search?, dueBefore?, limit? } → [{ id, title, status, priority, dueDate, projectId, projectName }]. Domyślnie pomija zadania DONE/CANCELLED (chyba że podasz status). dueBefore w ISO.
- list_shopping_lists: args { includeArchived? } → [{ id, name, pendingCount, totalCount, archived }]
- list_items: args { listId?, listName?, status?, search?, limit? } → [{ id, name, status, quantity, unit, listId, listName }]
- list_notes: args { search?, limit? } → [{ id, title, snippet, updatedAt }]
- list_pets: args { search? } → [{ id, name, species, status }]
- list_storage_items: args { search?, warehouse?, lowStockOnly?, limit? } → [{ id, name, quantity, unit, warehouse, location, minQuantity }]. Pozycje magazynu (dom/firma). lowStockOnly=true zwraca tylko poniżej stanu minimalnego.`;

export const READ_TOOL_NAMES = [
  "list_projects",
  "list_tasks",
  "list_shopping_lists",
  "list_items",
  "list_notes",
  "list_pets",
  "list_storage_items",
] as const;

async function accessibleProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

async function accessibleListWhere(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };
}

/**
 * Uruchamia jedno narzędzie odczytu w zakresie dostępu użytkownika.
 * Zwraca zwięzłą tablicę obiektów (gotową do serializacji JSON do transkryptu LLM).
 */
export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  switch (name) {
    case "list_projects": {
      const projects = await prisma.taskProject.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        include: { _count: { select: { tasks: true } } },
        orderBy: [{ isInbox: "desc" }, { createdAt: "asc" }],
      });
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        isInbox: p.isInbox,
        taskCount: p._count.tasks,
      }));
    }

    case "list_tasks": {
      const projectIds = await accessibleProjectIds(userId);
      const status = asStr(args.status);
      const priority = asStr(args.priority);
      const search = asStr(args.search);
      const dueBefore = asStr(args.dueBefore);
      const projectId = asStr(args.projectId);

      const where: Record<string, unknown> = {
        parentTaskId: null,
        OR: [
          { projectId: { in: projectIds } },
          { createdById: userId },
          { assigneeId: userId },
        ],
      };
      if (projectId) where.projectId = projectId;
      if (status) where.status = status;
      else where.status = { notIn: ["DONE", "CANCELLED"] };
      if (priority) where.priority = priority;
      if (search) where.title = { contains: search, mode: "insensitive" };
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
          project: { select: { name: true } },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { order: "asc" }],
        take: clampLimit(args.limit),
      });
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        projectId: t.projectId,
        projectName: t.project?.name ?? null,
      }));
    }

    case "list_shopping_lists": {
      const includeArchived = args.includeArchived === true;
      const lists = await prisma.shoppingList.findMany({
        where: { archived: includeArchived, ...(await accessibleListWhere(userId)) },
        orderBy: includeArchived ? { archivedAt: "desc" } : { createdAt: "asc" },
      });
      return Promise.all(
        lists.map(async (l) => {
          const [pendingCount, totalCount] = await Promise.all([
            prisma.item.count({ where: { listId: l.id, status: "NEEDED" } }),
            prisma.item.count({ where: { listId: l.id } }),
          ]);
          return { id: l.id, name: l.name, pendingCount, totalCount, archived: l.archived };
        })
      );
    }

    case "list_items": {
      const listId = asStr(args.listId);
      const listName = asStr(args.listName);
      const status = asStr(args.status);
      const search = asStr(args.search);

      // Zbiór list dostępnych użytkownikowi (zawęż do wskazanej, jeśli podano)
      const lists = await prisma.shoppingList.findMany({
        where: {
          ...(await accessibleListWhere(userId)),
          ...(listId ? { id: listId } : {}),
          ...(listName ? { name: { contains: listName, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true },
      });
      const listMap = new Map(lists.map((l) => [l.id, l.name]));
      const listIds = lists.map((l) => l.id);
      if (listIds.length === 0) return [];

      const items = await prisma.item.findMany({
        where: {
          listId: { in: listIds },
          ...(status ? { status } : {}),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: clampLimit(args.limit),
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        quantity: i.quantity,
        unit: i.unit,
        listId: i.listId,
        listName: listMap.get(i.listId) ?? null,
      }));
    }

    case "list_notes": {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const where: Record<string, unknown> = {
        OR: [
          { ownerId: userId },
          ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
        ],
      };
      if (search) {
        where.AND = [
          {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
      }
      const notes = await prisma.note.findMany({
        where,
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: clampLimit(args.limit),
      });
      return notes.map((n) => ({
        id: n.id,
        title: n.title,
        snippet: (n.content ?? "").slice(0, 120),
        updatedAt: n.updatedAt.toISOString(),
      }));
    }

    case "list_pets": {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const pets = await prisma.pet.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
            { shares: { some: { userId } } },
          ],
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, species: true, status: true },
        orderBy: { createdAt: "desc" },
        take: HARD_MAX,
      });
      return pets.map((p) => ({ id: p.id, name: p.name, species: p.species, status: p.status }));
    }

    case "list_storage_items": {
      const search = asStr(args.search);
      const warehouse = asStr(args.warehouse);
      const lowStockOnly = args.lowStockOnly === true || args.lowStockOnly === "true";
      const teamIds = await getUserTeamIds(userId);
      const items = await prisma.storageItem.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
          ],
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          ...(warehouse ? { warehouse: { contains: warehouse, mode: "insensitive" } } : {}),
          ...(lowStockOnly ? { minQuantity: { not: null } } : {}),
        },
        orderBy: [{ warehouse: "asc" }, { name: "asc" }],
        take: clampLimit(args.limit),
      });
      const filtered = lowStockOnly
        ? items.filter((i) => i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity)
        : items;
      return filtered.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        warehouse: i.warehouse,
        location: i.location,
        minQuantity: i.minQuantity,
      }));
    }

    default:
      throw new Error(`Nieznane narzędzie: ${name}`);
  }
}
