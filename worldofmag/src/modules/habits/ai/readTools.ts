import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";
import { SUFIT_LISTY } from "@/platform/pagination";
import { dataWStrefie, userTimeZone } from "@/lib/userTime";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_habits: args {} → [{ id, name, doneToday }]. Nawyki użytkownika (doneToday = czy odhaczony dziś).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_habits: async (args, userId) => {
      const habits = await prisma.habit.findMany({
        where: { archived: false, ...(await ownerScope(userId)) },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
        take: HARD_MAX,
      });
      // Dzień w strefie użytkownika — `toISOString()` to doba UTC, więc nocą asystent
      // raportował wczorajszy stan odhaczeń (rozjazd z widokiem /habits).
      const today = dataWStrefie(userTimeZone());
      const ids = habits.map((h) => h.id);
      const doneEntries = ids.length
        ? await prisma.habitEntry.findMany({
          take: SUFIT_LISTY,
            where: { habitId: { in: ids }, date: today },
            select: { habitId: true },
          })
        : [];
      const doneSet = new Set(doneEntries.map((e) => e.habitId));
      return habits.map((h) => ({ id: h.id, name: h.name, doneToday: doneSet.has(h.id) }));
  },
};
