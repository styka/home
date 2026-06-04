"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { isoDay, monthRange, type CalendarEvent } from "@/lib/calendar";
import { slotsForDate } from "@/lib/medicationSchedule";
import type { MedicationSchedule } from "@/types";

/**
 * Agreguje zdarzenia z wielu modułów (zadania, plan posiłków, zdrowie, przeglądy
 * floty) w jeden widok kalendarza. Read-only — bez nowej tabeli; źródłem są
 * istniejące modele, scoping wzorem user/zespół.
 */
export async function getCalendarEvents(year: number, month0: number): Promise<CalendarEvent[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const { start, end } = monthRange(year, month0);
  const ownScope = [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])];

  const [tasks, meals, health, vehicles, medications] = await Promise.all([
    // Zadania z terminem w miesiącu (pomijamy ukończone/anulowane — kalendarz to „co przede mną").
    prisma.task.findMany({
      where: {
        dueDate: { gte: start, lt: end },
        status: { notIn: ["DONE", "CANCELLED"] },
        OR: [
          { createdById: user.id },
          { assigneeId: user.id },
          { project: { OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] } },
        ],
      },
      select: { id: true, title: true, dueDate: true, projectId: true },
    }),
    prisma.mealPlanEntry.findMany({
      where: { date: { gte: start, lt: end }, OR: ownScope },
      select: { id: true, date: true, slot: true, customTitle: true, recipe: { select: { title: true } } },
    }),
    prisma.healthEvent.findMany({
      where: { scheduledAt: { gte: start, lt: end }, status: { not: "CANCELLED" }, OR: ownScope },
      select: { id: true, title: true, scheduledAt: true, kind: true },
    }),
    prisma.vehicle.findMany({
      where: {
        OR: ownScope,
        AND: [{ OR: [{ inspectionDue: { gte: start, lt: end } }, { insuranceDue: { gte: start, lt: end } }] }],
      },
      select: { id: true, name: true, inspectionDue: true, insuranceDue: true },
    }),
    // Aktywne harmonogramy leków/pielęgnacji — sloty rozwijamy poniżej per dzień.
    prisma.medicationSchedule.findMany({ where: { active: true, OR: ownScope } }),
  ]);

  const events: CalendarEvent[] = [];

  for (const t of tasks) {
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

  for (const m of meals) {
    const title = m.recipe?.title ?? m.customTitle ?? "Posiłek";
    events.push({
      id: `meal-${m.id}`,
      module: "kitchen",
      title: `${title} (${m.slot})`,
      date: isoDay(m.date),
      at: null,
      href: "/kitchen/plan",
      accent: "var(--accent-orange)",
    });
  }

  for (const h of health) {
    events.push({
      id: `health-${h.id}`,
      module: "health",
      title: h.title,
      date: isoDay(h.scheduledAt),
      at: h.scheduledAt.toISOString(),
      href: "/health",
      accent: "var(--accent-red)",
    });
  }

  for (const v of vehicles) {
    if (v.inspectionDue && v.inspectionDue >= start && v.inspectionDue < end) {
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
    if (v.insuranceDue && v.insuranceDue >= start && v.insuranceDue < end) {
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

  // Leki/pielęgnacja: rozwiń każdy harmonogram na sloty należne w dniach miesiąca.
  for (let day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
    for (const s of medications as MedicationSchedule[]) {
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

  // Sortuj wg dnia, potem wg godziny (zdarzenia bez godziny na końcu dnia).
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.at && b.at) return a.at < b.at ? -1 : 1;
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });

  return events;
}
