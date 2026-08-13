import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { prisma } from "@/platform/db/prisma";

import { ownedWhereAsync } from "@/platform/auth/serverUtils";
/**
 * 050: wkład Zakupów do migawki pulpitu — liczba pozycji do kupienia na niezarchiwizowanych listach.
 *
 * Zapytania **przeniesione bez zmiany** z trasy: te same `where`, ten sam dwuetapowy odczyt
 * (najpierw listy w zakresie użytkownika/zespołu, potem pozycje `NEEDED` na tych listach).
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "pendingItems">> = async (userId, ctx) => {
  const listy = await prisma.shoppingList.findMany({
    where: {
      archived: false,
      ...(await ownedWhereAsync(userId)),
    },
    select: { id: true },
  });
  const listIds = listy.map((l) => l.id);
  const pendingItems = listIds.length > 0
    ? await prisma.item.count({ where: { listId: { in: listIds }, status: "NEEDED" } })
    : 0;
  return { pendingItems };
};

export default wklad;
