"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import type { Habit, HabitWithStats } from "@/types";
import {
  todayISO,
  isoDate,
  computeStreaks,
  isScheduledOn,
  weekProgress,
} from "@/lib/habitStats";

async function assertHabitAccess(id: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const h = await prisma.habit.findUnique({
    where: { id },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!h) throw new Error("Nawyk nie istnieje");
  if (h.ownerId === userId) return;
  if (h.ownerTeamId && teamIds.includes(h.ownerTeamId)) return;
  throw new Error("Brak dostępu do nawyku");
}

/** Lista nawyków w zasięgu użytkownika/zespołu, wzbogacona o statystyki. */
export async function getHabits(opts?: { includeArchived?: boolean }): Promise<HabitWithStats[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  // Wpisy z ostatniego roku — wystarczą do heatmapy i streaków.
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const sinceISO = isoDate(yearAgo);

  const habits = await prisma.habit.findMany({
    where: {
      OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])],
      ...(opts?.includeArchived ? {} : { archived: false }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      entries: {
        where: { date: { gte: sinceISO } },
        select: { date: true },
        orderBy: { date: "asc" },
      },
    },
  });

  const today = todayISO();
  const now = new Date();

  return habits.map((h) => {
    const entryDates = h.entries.map((e) => e.date);
    const set = new Set(entryDates);
    const { currentStreak, longestStreak } = computeStreaks(entryDates, h.daysOfWeek);
    const { done: weekDone, target: weekTarget } = weekProgress(entryDates, h.daysOfWeek);
    return {
      id: h.id,
      name: h.name,
      description: h.description,
      icon: h.icon,
      color: h.color,
      daysOfWeek: h.daysOfWeek,
      reminderTime: h.reminderTime,
      archived: h.archived,
      sortOrder: h.sortOrder,
      ownerId: h.ownerId,
      ownerTeamId: h.ownerTeamId,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      entryDates,
      completedToday: set.has(today),
      scheduledToday: isScheduledOn(h.daysOfWeek, now),
      currentStreak,
      longestStreak,
      weekDone,
      weekTarget,
    };
  });
}

function normalizeDays(daysOfWeek?: string | null): string | null {
  if (daysOfWeek == null) return null;
  const parts = daysOfWeek
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const uniq = Array.from(new Set(parts)).sort((a, b) => a - b);
  // Pełny tydzień = codziennie → zapisujemy null (czytelniej, mniej brzegów).
  if (uniq.length === 0 || uniq.length === 7) return null;
  return uniq.join(",");
}

function normalizeReminder(reminderTime?: string | null): string | null {
  if (!reminderTime || !reminderTime.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(reminderTime.trim());
  if (!m) return null;
  const hh = Math.min(23, Number(m[1]));
  const mm = Math.min(59, Number(m[2]));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function createHabit(data: {
  name: string;
  description?: string | null;
  icon?: string;
  color?: string;
  daysOfWeek?: string | null;
  reminderTime?: string | null;
  ownerTeamId?: string | null;
}): Promise<Habit> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa nawyku jest wymagana");

  let ownerTeamId: string | null = null;
  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
    ownerTeamId = data.ownerTeamId;
  }

  // Nowy nawyk na początek listy.
  const min = await prisma.habit.aggregate({
    where: { OR: [{ ownerId: user.id }, ...(ownerTeamId ? [{ ownerTeamId }] : [])] },
    _min: { sortOrder: true },
  });

  const habit = await prisma.habit.create({
    data: {
      name,
      description: data.description?.trim() || null,
      icon: data.icon?.trim() || "✅",
      color: data.color?.trim() || "var(--accent-orange)",
      daysOfWeek: normalizeDays(data.daysOfWeek),
      reminderTime: normalizeReminder(data.reminderTime),
      sortOrder: (min._min.sortOrder ?? 0) - 1,
      ownerId: ownerTeamId ? null : user.id,
      ownerTeamId,
    },
  });
  revalidatePath("/habits");
  return habit as Habit;
}

export async function updateHabit(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    icon?: string;
    color?: string;
    daysOfWeek?: string | null;
    reminderTime?: string | null;
  }
): Promise<void> {
  const user = await requireAuth();
  await assertHabitAccess(id, user.id);

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nazwa nawyku jest wymagana");
    data.name = name;
  }
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.icon !== undefined) data.icon = patch.icon?.trim() || "✅";
  if (patch.color !== undefined) data.color = patch.color?.trim() || "var(--accent-orange)";
  if (patch.daysOfWeek !== undefined) data.daysOfWeek = normalizeDays(patch.daysOfWeek);
  if (patch.reminderTime !== undefined) data.reminderTime = normalizeReminder(patch.reminderTime);

  await prisma.habit.update({ where: { id }, data });
  revalidatePath("/habits");
}

export async function setHabitArchived(id: string, archived: boolean): Promise<void> {
  const user = await requireAuth();
  await assertHabitAccess(id, user.id);
  await prisma.habit.update({ where: { id }, data: { archived } });
  revalidatePath("/habits");
}

export async function deleteHabit(id: string): Promise<void> {
  const user = await requireAuth();
  await assertHabitAccess(id, user.id);
  await prisma.habit.delete({ where: { id } });
  revalidatePath("/habits");
}

/** Przełącza wykonanie nawyku w danym dniu ("YYYY-MM-DD", domyślnie dziś). */
export async function toggleHabitDay(id: string, date?: string): Promise<{ done: boolean }> {
  const user = await requireAuth();
  await assertHabitAccess(id, user.id);
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  // Nie pozwalamy odhaczać przyszłości.
  if (day > todayISO()) throw new Error("Nie można odhaczyć przyszłego dnia");

  const existing = await prisma.habitEntry.findUnique({
    where: { habitId_date: { habitId: id, date: day } },
  });
  if (existing) {
    await prisma.habitEntry.delete({ where: { id: existing.id } });
    revalidatePath("/habits");
    return { done: false };
  }
  await prisma.habitEntry.create({ data: { habitId: id, date: day } });
  revalidatePath("/habits");
  return { done: true };
}

/** Zapisuje nową kolejność nawyków (lista id w docelowej kolejności). */
export async function reorderHabits(orderedIds: string[]): Promise<void> {
  const user = await requireAuth();
  for (let i = 0; i < orderedIds.length; i++) {
    await assertHabitAccess(orderedIds[i], user.id);
    await prisma.habit.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } });
  }
  revalidatePath("/habits");
}
