import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";

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

async function ownScope(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])];
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const rows = await prisma.vehicle.findMany({
    where: {
      OR: await ownScope(userId),
      AND: [{ OR: [{ inspectionDue: { gte: from, lt: to } }, { insuranceDue: { gte: from, lt: to } }] }],
    },
    select: { id: true, name: true, inspectionDue: true, insuranceDue: true },
  });
  const events: CalendarContribEvent[] = [];
  for (const v of rows) {
    if (v.inspectionDue && v.inspectionDue >= from && v.inspectionDue < to) {
      events.push({
        id: `veh-insp-${v.id}`,
        module: "flota",
        title: `Przegląd: ${v.name}`,
        date: isoDay(v.inspectionDue),
        at: null,
        href: "/flota",
        accent: "var(--accent-blue)",
      });
    }
    if (v.insuranceDue && v.insuranceDue >= from && v.insuranceDue < to) {
      events.push({
        id: `veh-ins-${v.id}`,
        module: "flota",
        title: `OC/AC: ${v.name}`,
        date: isoDay(v.insuranceDue),
        at: null,
        href: "/flota",
        accent: "var(--accent-blue)",
      });
    }
  }
  return events;
}
