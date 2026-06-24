import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { isoDay, monthRange, type CalendarEvent } from "@/lib/calendar";
import { slotsForDate } from "@/lib/medicationSchedule";
import type { MedicationSchedule } from "@/types";

/**
 * Z-150: rdzeń agregacji kalendarza dla KONKRETNEGO usera (bez `requireAuth`).
 * Wyodrębniony z `actions/calendar.ts`, by mógł go użyć też feed iCal (auth tokenem,
 * bez sesji). To zwykły moduł serwerowy (NIE "use server") — `userId` nie pochodzi
 * od klienta, lecz z sesji (akcja) albo z odwoływalnego tokenu feedu (route).
 */
export async function collectCalendarEvents(userId: string, year: number, month0: number): Promise<CalendarEvent[]> {
  const teamIds = await getUserTeamIds(userId);
  const { start, end } = monthRange(year, month0);
  const ownScope = [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])];

  const petScope = { pet: { is: { OR: ownScope } } };

  const [tasks, meals, health, vehicles, medications, petCare, petTreatments, dueCards, serviceBookings] = await Promise.all([
    prisma.task.findMany({
      where: {
        dueDate: { gte: start, lt: end },
        status: { notIn: ["DONE", "CANCELLED"] },
        OR: [
          { createdById: userId },
          { assigneeId: userId },
          { project: { OR: [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] } },
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
    prisma.medicationSchedule.findMany({ where: { active: true, OR: ownScope } }),
    prisma.petCareTask.findMany({
      where: { active: true, nextDueAt: { gte: start, lt: end }, ...petScope },
      select: { id: true, title: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.petTreatment.findMany({
      where: { active: true, nextDueAt: { gte: start, lt: end }, ...petScope },
      select: { id: true, name: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.vocabulary.findMany({
      where: { dueAt: { gte: start, lt: end }, deck: { is: { OR: ownScope } } },
      select: { id: true, dueAt: true, deckId: true, deck: { select: { name: true } } },
    }),
    prisma.serviceRequest.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        status: { in: ["SCHEDULED", "ACCEPTED", "IN_PROGRESS"] },
        OR: [{ clientId: userId }, { provider: { is: { userId } } }],
      },
      select: { id: true, title: true, scheduledAt: true, clientId: true },
    }),
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

  for (const c of petCare) {
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

  for (const t of petTreatments) {
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

  // Powtórki SRS: zgrupuj fiszki per talia+dzień, by nie zalać kalendarza pojedynczymi słówkami.
  const srsByKey = new Map<string, { deckId: string; deck: string; date: string; count: number }>();
  for (const card of dueCards) {
    const date = isoDay(card.dueAt);
    const key = `${card.deckId}-${date}`;
    const entry = srsByKey.get(key);
    if (entry) entry.count += 1;
    else srsByKey.set(key, { deckId: card.deckId, deck: card.deck?.name ?? "Talia", date, count: 1 });
  }
  for (const g of Array.from(srsByKey.values())) {
    events.push({
      id: `srs-${g.deckId}-${g.date}`,
      module: "languages",
      title: `Powtórka: ${g.deck} (${g.count})`,
      date: g.date,
      at: null,
      href: "/languages",
      accent: "var(--accent-purple)",
    });
  }

  for (const b of serviceBookings) {
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
