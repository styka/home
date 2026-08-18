"use server";

import { prisma } from "@/platform/db/prisma";
import { requireAuth, getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
import { isoDay } from "@/modules/calendar/contract";
import { notifyUser } from "@/lib/notify";
import { isScheduledOn, weekDoneCount } from "@/lib/habitStats";

/**
 * 093 (zadanie 20): górna granica dla zapytań synchronizacji przypomnień.
 *
 * Wszystkie są okienkowane po czasie (najbliższe 3/7/14 dni), więc w normalnym użyciu zwracają
 * kilkanaście wierszy. `take` nie jest tu paginacją — jest **bezpiecznikiem**: konto z pięcioma
 * tysiącami zaległych zadań wygenerowałoby pięć tysięcy powiadomień, czyli spam, którego nikt nie
 * przeczyta, i tabelę, która rośnie od jednego kliknięcia. Dwieście to więcej, niż ktokolwiek ogarnie
 * w jednym przebiegu, i mniej, niż potrzeba do zrobienia szkody.
 */
const LIMIT_PRZYPOMNIEN = 200;

export type NotificationDTO = {
  id: string;
  module: string;
  title: string;
  body: string | null;
  href: string | null;
  dueAt: string | null;
  readAt: string | null;
  createdAt: string;
};

const MS_DAY = 24 * 60 * 60 * 1000;

/** Lista ostatnich powiadomień użytkownika (nieprzeczytane najpierw). */
export async function getNotifications(limit = 30): Promise<NotificationDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id,
    module: n.module,
    title: n.title,
    body: n.body,
    href: n.href,
    dueAt: n.dueAt?.toISOString() ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireAuth();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * Skan terminów pod free tier (bez crona): wołany przy logowaniu / otwarciu
 * dzwonka. Skanuje nadchodzące i zaległe terminy ze wszystkich modułów i tworzy
 * powiadomienia idempotentnie (dedupeKey). Zwraca liczbę nieprzeczytanych.
 */
export async function syncReminders(): Promise<number> {
  const user = await requireAuth();
  const ownScope = (await ownedOrAsync(user.id));
  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * MS_DAY);
  const in7 = new Date(now.getTime() + 7 * MS_DAY);
  const in14 = new Date(now.getTime() + 14 * MS_DAY);

  const weekLookbackISO = isoDay(new Date(now.getTime() - 8 * MS_DAY));
  const [tasks, health, vehicles, petCare, petTreatments, pantry, dueCards, svcRequests, habits] = await Promise.all([
    prisma.task.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: {
        dueDate: { lt: in3 },
        status: { notIn: ["DONE", "CANCELLED"] },
        OR: [
          { createdById: user.id },
          { assigneeId: user.id },
          { project: { OR: ownScope } },
        ],
      },
      select: { id: true, title: true, dueDate: true, projectId: true },
    }),
    prisma.healthEvent.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { scheduledAt: { gte: now, lt: in7 }, status: { notIn: ["CANCELLED", "DONE"] }, OR: ownScope },
      select: { id: true, title: true, scheduledAt: true },
    }),
    prisma.vehicle.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { OR: ownScope, AND: [{ OR: [{ inspectionDue: { lt: in14 } }, { insuranceDue: { lt: in14 } }] }] },
      select: { id: true, name: true, inspectionDue: true, insuranceDue: true },
    }),
    prisma.petCareTask.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { active: true, nextDueAt: { gte: now, lt: in3 }, pet: { is: { OR: ownScope } } },
      select: { id: true, title: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.petTreatment.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { active: true, nextDueAt: { gte: now, lt: in3 }, pet: { is: { OR: ownScope } } },
      select: { id: true, name: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.pantryItem.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { expiresAt: { gte: now, lt: in3 }, OR: ownScope },
      select: { id: true, name: true, expiresAt: true },
    }),
    prisma.vocabulary.count({ where: { dueAt: { lt: now }, deck: { is: { OR: ownScope } } } }),
    prisma.serviceRequest.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { status: "REQUESTED", provider: { is: { userId: user.id } } },
      select: { id: true, title: true },
    }),
    // Z-280: nawyki zaplanowane na dziś, jeszcze nieodhaczone (entries z bieżącego tygodnia).
    prisma.habit.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { archived: false, OR: ownScope },
      select: { id: true, name: true, daysOfWeek: true, weeklyGoal: true, entries: { where: { date: { gte: weekLookbackISO } }, select: { date: true } } },
    }),
  ]);

  const jobs: Promise<void>[] = [];

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const overdue = t.dueDate < now;
    jobs.push(notifyUser({
      userId: user.id,
      module: "tasks",
      title: overdue ? `Zaległe zadanie: ${t.title}` : `Termin zadania: ${t.title}`,
      dueAt: t.dueDate,
      href: t.projectId ? `/tasks/${t.projectId}` : "/tasks",
      dedupeKey: `task-due-${t.id}-${isoDay(t.dueDate)}`,
    }));
  }
  for (const h of health) {
    jobs.push(notifyUser({
      userId: user.id, module: "health", title: `Nadchodzące: ${h.title}`,
      dueAt: h.scheduledAt, href: "/health", dedupeKey: `health-${h.id}`,
    }));
  }
  for (const v of vehicles) {
    if (v.inspectionDue && v.inspectionDue < in14) jobs.push(notifyUser({
      userId: user.id, module: "flota", title: `Przegląd: ${v.name}`,
      dueAt: v.inspectionDue, href: "/flota", dedupeKey: `veh-insp-${v.id}-${isoDay(v.inspectionDue)}`,
    }));
    if (v.insuranceDue && v.insuranceDue < in14) jobs.push(notifyUser({
      userId: user.id, module: "flota", title: `OC/AC: ${v.name}`,
      dueAt: v.insuranceDue, href: "/flota", dedupeKey: `veh-ins-${v.id}-${isoDay(v.insuranceDue)}`,
    }));
  }
  for (const c of petCare) {
    if (!c.nextDueAt) continue;
    jobs.push(notifyUser({
      userId: user.id, module: "pets", title: `Opieka: ${c.title}${c.pet?.name ? ` — ${c.pet.name}` : ""}`,
      dueAt: c.nextDueAt, href: `/pets/${c.petId}`, dedupeKey: `petcare-${c.id}-${isoDay(c.nextDueAt)}`,
    }));
  }
  for (const tr of petTreatments) {
    if (!tr.nextDueAt) continue;
    jobs.push(notifyUser({
      userId: user.id, module: "pets", title: `Leczenie: ${tr.name}${tr.pet?.name ? ` — ${tr.pet.name}` : ""}`,
      dueAt: tr.nextDueAt, href: `/pets/${tr.petId}`, dedupeKey: `pettreat-${tr.id}-${isoDay(tr.nextDueAt)}`,
    }));
  }
  for (const p of pantry) {
    if (!p.expiresAt) continue;
    jobs.push(notifyUser({
      userId: user.id, module: "kitchen", title: `Kończy się termin: ${p.name}`,
      dueAt: p.expiresAt, href: "/kitchen/pantry", dedupeKey: `pantry-${p.id}-${isoDay(p.expiresAt)}`,
    }));
  }
  if (dueCards > 0) {
    jobs.push(notifyUser({
      userId: user.id, module: "languages", title: `${dueCards} słówek do powtórki`,
      href: "/languages", dedupeKey: `srs-${isoDay(now)}`,
    }));
  }
  for (const r of svcRequests) {
    jobs.push(notifyUser({
      userId: user.id, module: "services", title: `Nowe zlecenie: ${r.title}`,
      href: "/services/requests", dedupeKey: `svc-req-${r.id}`,
    }));
  }
  // Z-280: przypomnienia o nawykach zaplanowanych na dziś i jeszcze nieodhaczonych.
  // Tryb celu tygodniowego → przypominaj póki tydzień niedomknięty; tryb dni → wg daysOfWeek.
  const todayIso = isoDay(now);
  for (const h of habits) {
    const entryDates = h.entries.map((e) => e.date);
    const goal = h.weeklyGoal && h.weeklyGoal > 0 ? h.weeklyGoal : null;
    const scheduledToday = goal ? weekDoneCount(entryDates) < goal : isScheduledOn(h.daysOfWeek, now);
    if (scheduledToday && !entryDates.includes(todayIso)) {
      jobs.push(notifyUser({
        userId: user.id, module: "habits", title: `Nawyk na dziś: ${h.name}`,
        dueAt: now, href: "/habits", dedupeKey: `habit-${h.id}-${todayIso}`,
      }));
    }
  }

  await Promise.all(jobs);
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}
