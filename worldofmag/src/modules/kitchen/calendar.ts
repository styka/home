import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds, ownedOr } from "@/platform/auth/serverUtils";
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
  return ownedOr(userId, teamIds);
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const rows = await prisma.mealPlanEntry.findMany({
    where: { date: { gte: from, lt: to }, OR: await ownScope(userId) },
    select: { id: true, date: true, slot: true, customTitle: true, recipe: { select: { title: true } } },
  });
  return rows.map((m) => ({
    id: `meal-${m.id}`,
    module: "kitchen",
    title: `${m.recipe?.title ?? m.customTitle ?? "Posiłek"} (${m.slot})`,
    date: isoDay(m.date),
    at: null,
    href: "/kitchen/plan",
    accent: "var(--accent-orange)",
  }));
}
