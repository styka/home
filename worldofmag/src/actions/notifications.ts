"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { isoDay } from "@/lib/calendar";
import { isScheduledOn, weekDoneCount } from "@/lib/habitStats";

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

/**
 * Tworzy powiadomienie idempotentnie po (userId, dedupeKey). Wołane przez skan
 * terminów (poniżej) oraz przez inne moduły przy zdarzeniach (np. marketplace).
 * Gdy `dedupeKey` jest puste — zawsze tworzy nowe (ad-hoc).
 */
export async function notifyUser(input: {
  userId: string;
  module: string;
  title: string;
  body?: string | null;
  href?: string | null;
  dueAt?: Date | null;
  dedupeKey?: string | null;
}): Promise<void> {
  const data = {
    module: input.module,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    dueAt: input.dueAt ?? null,
  };
  if (input.dedupeKey) {
    await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
      create: { userId: input.userId, dedupeKey: input.dedupeKey, ...data },
      update: {}, // istnieje → nie duplikuj i nie „odczytuj" ponownie
    });
  } else {
    await prisma.notification.create({ data: { userId: input.userId, ...data } });
  }
}

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
  const teamIds = await getUserTeamIds(user.id);
  const ownScope = [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])];
  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * MS_DAY);
  const in7 = new Date(now.getTime() + 7 * MS_DAY);
  const in14 = new Date(now.getTime() + 14 * MS_DAY);

  const weekLookbackISO = isoDay(new Date(now.getTime() - 8 * MS_DAY));
  const [tasks, health, vehicles, petCare, petTreatments, pantry, dueCards, svcRequests, habits] = await Promise.all([
    prisma.task.findMany({
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
      where: { scheduledAt: { gte: now, lt: in7 }, status: { notIn: ["CANCELLED", "DONE"] }, OR: ownScope },
      select: { id: true, title: true, scheduledAt: true },
    }),
    prisma.vehicle.findMany({
      where: { OR: ownScope, AND: [{ OR: [{ inspectionDue: { lt: in14 } }, { insuranceDue: { lt: in14 } }] }] },
      select: { id: true, name: true, inspectionDue: true, insuranceDue: true },
    }),
    prisma.petCareTask.findMany({
      where: { active: true, nextDueAt: { gte: now, lt: in3 }, pet: { is: { OR: ownScope } } },
      select: { id: true, title: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.petTreatment.findMany({
      where: { active: true, nextDueAt: { gte: now, lt: in3 }, pet: { is: { OR: ownScope } } },
      select: { id: true, name: true, nextDueAt: true, petId: true, pet: { select: { name: true } } },
    }),
    prisma.pantryItem.findMany({
      where: { expiresAt: { gte: now, lt: in3 }, OR: ownScope },
      select: { id: true, name: true, expiresAt: true },
    }),
    prisma.vocabulary.count({ where: { dueAt: { lt: now }, deck: { is: { OR: ownScope } } } }),
    prisma.serviceRequest.findMany({
      where: { status: "REQUESTED", provider: { is: { userId: user.id } } },
      select: { id: true, title: true },
    }),
    // Z-280: nawyki zaplanowane na dziś, jeszcze nieodhaczone (entries z bieżącego tygodnia).
    prisma.habit.findMany({
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
