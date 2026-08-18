import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
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

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const rows = await prisma.task.findMany({
    where: {
      dueDate: { gte: from, lt: to },
      status: { notIn: ["DONE", "CANCELLED"] },
      OR: [
        { createdById: userId },
        { assigneeId: userId },
        { project: { OR: (await ownedOrAsync(userId)) } },
      ],
    },
    select: { id: true, title: true, dueDate: true, projectId: true },
  });
  const events: CalendarContribEvent[] = [];
  for (const t of rows) {
    if (!t.dueDate) continue;
    events.push({
      id: `task-${t.id}`,
      module: "tasks",
      title: t.title,
      date: isoDay(t.dueDate),
      at: t.dueDate.toISOString(),
      href: t.projectId ? `/tasks/${t.projectId}` : "/tasks",
      accent: "var(--accent-green)",
    });
  }
  return events;
}
