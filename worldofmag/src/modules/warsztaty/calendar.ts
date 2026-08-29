import { prisma } from "@/platform/db/prisma";
import { ownedOrAsync } from "@/platform/auth/serverUtils";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * Wkład Warsztatów do wspólnej agendy: terminy przeglądów sprzętu (`WorkshopItem.nextServiceAt`).
 *
 * Semantyka identyczna jak przeglądy pojazdów we Flocie — termin serwisu to data, na którą
 * użytkownik ma się stawić z narzędziem/maszyną. Moduł miał już własną agendę Pro
 * (`/warsztaty/przeglady`, `getMaintenanceOverview`), ale wspólny kalendarz jej nie widział,
 * więc „wszystkie terminy w jednym miejscu" było fałszywe dla warsztatu.
 */

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const items = await prisma.workshopItem.findMany({
    take: SUFIT_LISTY,
    where: {
      nextServiceAt: { gte: from, lt: to },
      workshop: { is: { OR: await ownedOrAsync(userId) } },
    },
    select: { id: true, name: true, nextServiceAt: true, workshopId: true, workshop: { select: { name: true } } },
    orderBy: { nextServiceAt: "asc" },
  });

  return items
    .filter((i) => i.nextServiceAt != null)
    .map((i) => ({
      id: `warsztat-serwis-${i.id}`,
      module: "warsztaty",
      title: `Przegląd: ${i.name}${i.workshop?.name ? ` (${i.workshop.name})` : ""}`,
      date: isoDay(i.nextServiceAt as Date),
      at: null,
      href: `/warsztaty/${i.workshopId}`,
      accent: "var(--accent-amber)",
    }));
}
