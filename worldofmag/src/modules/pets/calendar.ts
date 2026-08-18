import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
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

async function ownScope(userId: string) {
  return (await ownedOrAsync(userId));
}

export default async function calendarEvents(userId: string, { from, to }: CalendarRange): Promise<CalendarContribEvent[]> {
  const petScope = { pet: { is: { OR: await ownScope(userId) } } };
  const [care, treatments] = await Promise.all([
    prisma.petCareTask.findMany({
      take: SUFIT_LISTY,
      where: { active: true, nextDueAt: { gte: from, lt: to }, ...petScope },
      select: { id: true, title: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.petTreatment.findMany({
      take: SUFIT_LISTY,
      where: { active: true, nextDueAt: { gte: from, lt: to }, ...petScope },
      select: { id: true, name: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
  ]);

  const events: CalendarContribEvent[] = [];
  for (const c of care) {
    if (!c.nextDueAt) continue;
    events.push({
      id: `petcare-${c.id}`,
      module: "pets",
      title: `${c.title}${c.pet?.name ? ` — ${c.pet.name}` : ""}`,
      date: isoDay(c.nextDueAt),
      at: c.nextDueAt.toISOString(),
      href: `/pets/${c.petId}`,
      accent: "var(--accent-orange)",
    });
  }
  for (const t of treatments) {
    if (!t.nextDueAt) continue;
    events.push({
      id: `pettreat-${t.id}`,
      module: "pets",
      title: `${t.name}${t.pet?.name ? ` — ${t.pet.name}` : ""}`,
      date: isoDay(t.nextDueAt),
      at: t.nextDueAt.toISOString(),
      href: `/pets/${t.petId}`,
      accent: "var(--accent-orange)",
    });
  }
  return events;
}
