"use server";

import { prisma } from "@/platform/db/prisma";
import { requireAuth, getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
import { isoDay } from "@/modules/calendar/contract";
import { notifyUser } from "@/lib/notify";
import { isScheduledOn, weekDoneCount } from "@/lib/habitStats";
import { getPendingInvitationsCount } from "@/actions/invitations";
import type { RodzajPowiadomienia } from "@/types";

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
  rodzaj: RodzajPowiadomienia;
  title: string;
  body: string | null;
  href: string | null;
  dueAt: string | null;
  readAt: string | null;
  createdAt: string;
};

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Lista ostatnich powiadomień użytkownika (nieprzeczytane najpierw).
 *
 * 107: `rodzaj` zawęża do JEDNEGO segmentu skrzynki. Filtrujemy w zapytaniu, nie po stronie
 * klienta — inaczej `take` obcinałby „50 najnowszych ogółem" i sprawa sprzed tygodnia nigdy nie
 * trafiłaby do listy, która po to istnieje (dokładnie ten błąd naprawiało 106 w listach rozmów
 * asystenta).
 */
export async function getNotifications(
  opcje: { rodzaj?: RodzajPowiadomienia; limit?: number } = {},
): Promise<NotificationDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id, ...(opcje.rodzaj ? { rodzaj: opcje.rodzaj } : {}) },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: opcje.limit ?? 30,
  });
  return rows.map((n) => ({
    id: n.id,
    module: n.module,
    rodzaj: (n.rodzaj === "relacja" ? "relacja" : "zadanie") as RodzajPowiadomienia,
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

/** 107: liczniki segmentów skrzynki. */
export type LicznikiSkrzynki = {
  /** Nieprzeczytane przypomnienia („mam coś zrobić"). */
  zadania: number;
  /** Nieprzeczytane sprawy z ludźmi + oczekujące zaproszenia — razem, bo tyle spraw czeka. */
  relacje: number;
};

/**
 * 107 — LICZNIKI SKRZYNKI dla przełącznika segmentowego i dla odznaki przy dzwonku.
 *
 * Zaproszenia do zespołu liczymy z ICH WŁASNEJ tabeli, a nie z kopii w powiadomieniach. Kopia
 * byłaby drugim nośnikiem tego samego stanu i przeżyłaby przyjęcie zaproszenia — czyli odznaka
 * mówiłaby o sprawie, której już nie ma (AC-8, AC-9).
 *
 * Liczymy przez `count`, nie przez pobranie listy: liczba nie może zależeć od tego, ile wierszy
 * zmieściło się w `take`.
 */
export async function getLicznikiSkrzynki(): Promise<LicznikiSkrzynki> {
  const user = await requireAuth();
  const [zadania, relacjeNieprzeczytane, zaproszenia] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null, rodzaj: "zadanie" } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null, rodzaj: "relacja" } }),
    getPendingInvitationsCount(),
  ]);
  return { zadania, relacje: relacjeNieprzeczytane + zaproszenia };
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * „Oznacz wszystkie jako przeczytane".
 *
 * 107: `rodzaj` ogranicza to do OGLĄDANEJ listy. Bez tego przycisk stojący nad jednym segmentem
 * gasiłby też drugi, którego użytkownik w tej chwili nie widzi — a to jest utrata informacji
 * wykonana cudzym gestem.
 */
export async function markAllNotificationsRead(rodzaj?: RodzajPowiadomienia): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(rodzaj ? { rodzaj } : {}) },
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
  const [tasks, health, vehicles, petCare, petTreatments, pantry, dueCards, svcRequests, habits, plantCare] = await Promise.all([
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
    // 113: zabiegi przy roślinach. Zakres idzie przez PRZESTRZEŃ, a nie przez zadanie:
    // `PlantCareTask` nie ma własnej kolumny przestrzeni (wisi na `PlantSpace`), więc pytanie
    // o nią byłoby pytaniem o pole, którego ta tabela nie ma — dokładnie ten błąd łapie
    // bramka `check:owner-columns`.
    prisma.plantCareTask.findMany({
      take: LIMIT_PRZYPOMNIEN,
      where: { active: true, nextDueAt: { gte: now, lt: in3 }, space: { is: { OR: ownScope } } },
      select: { id: true, title: true, nextDueAt: true, spaceId: true, plantId: true, plant: { select: { name: true } } },
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
  for (const z of plantCare) {
    if (!z.nextDueAt) continue;
    jobs.push(notifyUser({
      userId: user.id,
      module: "rosliny",
      title: `Rośliny: ${z.title}${z.plant?.name ? ` — ${z.plant.name}` : ""}`,
      dueAt: z.nextDueAt,
      // Zadanie może dotyczyć całej grządki, a nie pojedynczej rośliny — wtedy prowadzimy do
      // przestrzeni. Adres do nieistniejącej rośliny byłby powiadomieniem donikąd.
      href: z.plantId ? `/rosliny/${z.spaceId}/roslina/${z.plantId}` : `/rosliny/${z.spaceId}`,
      dedupeKey: `plantcare-${z.id}-${isoDay(z.nextDueAt)}`,
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
