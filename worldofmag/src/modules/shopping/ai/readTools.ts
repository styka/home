import { technicalToLabel } from "@/lib/ai/humanize";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, clampLimit, asStr, resolveRefOrThrow, accessibleListWhere } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_shopping_lists: args { includeArchived? } → [{ id, name, pendingCount, totalCount, archived }]",
  "- list_items: args { listId?, listName?, status?, search?, limit? } → [{ id, name, status, quantity, unit, listId, listName }]",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_shopping_lists: async (args, userId) => {
      const includeArchived = args.includeArchived === true;
      const lists = await prisma.shoppingList.findMany({
        where: { archived: includeArchived, ...(await accessibleListWhere(userId)) },
        orderBy: includeArchived ? { archivedAt: "desc" } : { createdAt: "asc" },
        take: HARD_MAX,
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
  },
  list_items: async (args, userId) => {
      const listId = asStr(args.listId);
      const listName = asStr(args.listName);
      const status = asStr(args.status);
      const search = asStr(args.search);

      // 032: liczymy dostęp RAZ i używamy w obu zapytaniach (resolver + główne) — `accessibleListWhere`
      // woła `getUserTeamIds`, więc dwa razy to dwa zapytania po to samo.
      const listAccess = await accessibleListWhere(userId);
      // 032: `listId` bywa NAZWĄ listy („moje”), nie identyfikatorem — wcześniej `where: { id: "moje" }`
      // dawało pustą listę i asystent twierdził, że nic tam nie ma. Rozwiązujemy referencję.
      const resolvedListId = listId
        ? await resolveRefOrThrow(listId, "listy zakupów", async () =>
            prisma.shoppingList.findMany({
              where: listAccess,
              select: { id: true, name: true },
              take: HARD_MAX,
            })
          )
        : undefined;

      // Zbiór list dostępnych użytkownikowi (zawęż do wskazanej, jeśli podano)
      const lists = await prisma.shoppingList.findMany({
        where: {
          ...listAccess,
          ...(resolvedListId ? { id: resolvedListId } : {}),
          ...(listName ? { name: { contains: listName, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true },
        take: HARD_MAX,
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
        status: technicalToLabel(i.status),
        quantity: i.quantity,
        unit: i.unit,
        listId: i.listId,
        listName: listMap.get(i.listId) ?? null,
      }));
  },
};
