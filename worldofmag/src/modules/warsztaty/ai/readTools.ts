import { getMaintenanceOverview } from "../contract";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, asStr, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_workshops: args { search? } → [{ id, name, type, itemCount }]. Warsztaty/pracownie użytkownika (np. stolarski, samochodowy, malarski) z liczbą pozycji wyposażenia.",
  "- list_maintenance: args {} → { serviceDue:[…], lowStock:[…] }. Przeglądy narzędzi/maszyn i niski stan materiałów w warsztatach (tryb Pro).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_workshops: async (args, userId) => {
      const search = asStr(args.search);
      const workshops = await prisma.workshop.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        include: { _count: { select: { items: true } } },
        orderBy: { updatedAt: "desc" },
        take: HARD_MAX,
      });
      return workshops.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        itemCount: w._count.items,
      }));
  },
  list_maintenance: async (args, userId) => {
      return getMaintenanceOverview();
  },
};
