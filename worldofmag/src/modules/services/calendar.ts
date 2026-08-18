import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 049: wkład tego modułu do wspólnej agendy kalendarza.
 *
 * Zapytanie i mapowanie są **przeniesione bez zmiany** z `collectCalendarEvents` — te same `where`,
 * ten sam `select`, te same identyfikatory zdarzeń i te same adresy. Zmienia się wyłącznie to, kto
 * jest właścicielem kodu: dotąd moduł Kalendarz sięgał do tabel sześciu innych modułów.
 */

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const rows = await prisma.serviceRequest.findMany({
    take: SUFIT_LISTY,
    where: {
      scheduledAt: { gte: from, lt: to },
      status: { in: ["SCHEDULED", "ACCEPTED", "IN_PROGRESS"] },
      OR: [{ clientId: userId }, { provider: { is: { userId } } }],
    },
    select: { id: true, title: true, scheduledAt: true, clientId: true },
  });
  const events: CalendarContribEvent[] = [];
  for (const b of rows) {
    if (!b.scheduledAt) continue;
    const asClient = b.clientId === userId;
    events.push({
      id: `svc-${b.id}`,
      module: "services",
      title: `${asClient ? "Wizyta" : "Klient"}: ${b.title}`,
      date: isoDay(b.scheduledAt),
      at: b.scheduledAt.toISOString(),
      href: asClient ? "/services/requests" : "/services/provider",
      accent: "var(--accent-blue)",
    });
  }
  return events;
}
