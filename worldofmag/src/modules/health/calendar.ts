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
import { slotsForDate } from "@/lib/medicationSchedule";
import type { MedicationSchedule } from "@/types";

/** „YYYY-MM-DD" w czasie lokalnym — ten sam format klucza dnia co w siatce kalendarza. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function ownScope(userId: string) {
  return (await ownedOrAsync(userId));
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const scope = await ownScope(userId);
  const [wizyty, leki] = await Promise.all([
    prisma.healthEvent.findMany({
      where: { scheduledAt: { gte: from, lt: to }, status: { not: "CANCELLED" }, OR: scope },
      select: { id: true, title: true, scheduledAt: true, kind: true },
    }),
    prisma.medicationSchedule.findMany({ where: { active: true, OR: scope } }),
  ]);

  const events: CalendarContribEvent[] = wizyty.map((h) => ({
    id: `health-${h.id}`,
    module: "health",
    title: h.title,
    date: isoDay(h.scheduledAt),
    at: h.scheduledAt.toISOString(),
    href: "/health",
    accent: "var(--accent-red)",
  }));

  // Leki/pielęgnacja: rozwiń każdy harmonogram na sloty należne w dniach zakresu.
  for (let day = new Date(from); day < to; day.setDate(day.getDate() + 1)) {
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
    for (const s of leki as MedicationSchedule[]) {
      for (const slot of slotsForDate(s, date)) {
        const [h, mm] = slot.split(":").map(Number);
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mm, 0, 0);
        events.push({
          id: `med-${s.id}-${isoDay(date)}-${slot}`,
          module: "health",
          title: `${s.name}${s.dosage ? ` ${s.dosage}` : ""} (${slot})`,
          date: isoDay(date),
          at: at.toISOString(),
          href: "/health/leki",
          accent: "var(--accent-red)",
        });
      }
    }
  }
  return events;
}
