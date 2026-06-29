"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds, getAccessibleTeamIds } from "@/lib/server-utils";
import { isoDate } from "@/lib/habitStats";
import { buildDayAgenda } from "@/lib/medicationSchedule";
import type {
  DoseSlot,
  MedicationFreqType,
  MedicationKind,
  MedicationLog,
  MedicationOutcome,
  MedicationSchedule,
} from "@/types";

function safeDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Normalizuje listę godzin do JSON ["HH:MM",…] (posortowane, unikalne, poprawne). */
function normTimes(times: string[] | string | null | undefined): string | null {
  let arr: string[];
  if (Array.isArray(times)) arr = times;
  else if (typeof times === "string" && times.trim()) {
    arr = times.split(",").map((t) => t.trim());
  } else return null;
  const valid = Array.from(new Set(arr.filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => {
    const [h, m] = t.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }))).sort();
  return valid.length ? JSON.stringify(valid) : null;
}

/** Normalizuje dni tygodnia do CSV "1,3,5" (0=nd..6=sb). */
function normDays(days: number[] | string | null | undefined): string | null {
  let arr: number[];
  if (Array.isArray(days)) arr = days;
  else if (typeof days === "string" && days.trim()) arr = days.split(",").map((d) => Number(d.trim()));
  else return null;
  const valid = Array.from(new Set(arr.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  return valid.length ? valid.join(",") : null;
}

function normFreq(v: string | null | undefined): MedicationFreqType {
  return v === "WEEKLY" || v === "HOURLY" ? v : "DAILY";
}

async function assertScheduleAccess(id: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const s = await prisma.medicationSchedule.findUnique({
    where: { id },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!s) throw new Error("Harmonogram nie istnieje");
  if (s.ownerId === userId) return;
  if (s.ownerTeamId && teamIds.includes(s.ownerTeamId)) return;
  throw new Error("Brak dostępu do harmonogramu");
}

// Z-194 (T-12): widoczność leków/pielęgnacji respektuje dostęp domownika do „health".
async function scopeWhere(userId: string) {
  const teamIds = await getAccessibleTeamIds(userId, "health");
  return { OR: [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] };
}

export async function getMedicationSchedules(): Promise<MedicationSchedule[]> {
  const user = await requireAuth();
  const schedules = await prisma.medicationSchedule.findMany({
    where: await scopeWhere(user.id),
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return schedules as MedicationSchedule[];
}

/** Agenda na dany dzień (domyślnie dziś): rozwinięte sloty + status odhaczenia. */
export async function getMedicationDay(date?: string): Promise<{ date: string; slots: DoseSlot[] }> {
  const user = await requireAuth();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : isoDate(new Date());

  const schedules = (await prisma.medicationSchedule.findMany({
    where: { active: true, ...(await scopeWhere(user.id)) },
  })) as MedicationSchedule[];

  const ids = schedules.map((s) => s.id);
  const logs = ids.length
    ? ((await prisma.medicationLog.findMany({ where: { scheduleId: { in: ids }, date: day } })) as MedicationLog[])
    : [];

  // Klucz dnia → Date lokalna (południe) do rozwinięcia slotów.
  const [y, m, d] = day.split("-").map(Number);
  const slots = buildDayAgenda(schedules, logs, new Date(y, m - 1, d, 12, 0, 0, 0));
  return { date: day, slots };
}

export type MedicationInput = {
  kind?: MedicationKind;
  name: string;
  dosage?: string | null;
  route?: string | null;
  reason?: string | null;
  instructions?: string | null;
  freqType?: MedicationFreqType;
  interval?: number;
  daysOfWeek?: number[] | string | null;
  timesOfDay?: string[] | string | null;
  hourlyStart?: string | null;
  hourlyEnd?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  notes?: string | null;
  ownerTeamId?: string | null;
};

export async function createMedicationSchedule(data: MedicationInput): Promise<MedicationSchedule> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Nazwa jest wymagana");

  let ownerTeamId: string | null = null;
  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
    ownerTeamId = data.ownerTeamId;
  }

  const freqType = normFreq(data.freqType);
  const schedule = await prisma.medicationSchedule.create({
    data: {
      kind: data.kind === "CARE" ? "CARE" : "MEDICATION",
      name,
      dosage: data.dosage?.trim() || null,
      route: data.route?.trim() || null,
      reason: data.reason?.trim() || null,
      instructions: data.instructions?.trim() || null,
      freqType,
      interval: Math.max(1, Math.round(data.interval ?? 1)),
      daysOfWeek: freqType === "WEEKLY" ? normDays(data.daysOfWeek) : null,
      timesOfDay: freqType === "HOURLY" ? null : normTimes(data.timesOfDay),
      hourlyStart: freqType === "HOURLY" ? (data.hourlyStart?.trim() || "08:00") : null,
      hourlyEnd: freqType === "HOURLY" ? (data.hourlyEnd?.trim() || "22:00") : null,
      startDate: safeDate(data.startDate) ?? new Date(),
      endDate: safeDate(data.endDate),
      notes: data.notes?.trim() || null,
      ownerId: ownerTeamId ? null : user.id,
      ownerTeamId,
    },
  });
  revalidateMed();
  return schedule as MedicationSchedule;
}

export async function updateMedicationSchedule(
  id: string,
  patch: Partial<MedicationInput> & { active?: boolean }
): Promise<void> {
  const user = await requireAuth();
  await assertScheduleAccess(id, user.id);

  const data: Record<string, unknown> = {};
  if (patch.kind !== undefined) data.kind = patch.kind === "CARE" ? "CARE" : "MEDICATION";
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.dosage !== undefined) data.dosage = patch.dosage?.trim() || null;
  if (patch.route !== undefined) data.route = patch.route?.trim() || null;
  if (patch.reason !== undefined) data.reason = patch.reason?.trim() || null;
  if (patch.instructions !== undefined) data.instructions = patch.instructions?.trim() || null;
  if (patch.interval !== undefined) data.interval = Math.max(1, Math.round(patch.interval));
  if (patch.startDate !== undefined) data.startDate = safeDate(patch.startDate) ?? new Date();
  if (patch.endDate !== undefined) data.endDate = safeDate(patch.endDate);
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.active !== undefined) data.active = patch.active;

  // Zmiana częstotliwości — przelicz powiązane pola spójnie z trybem.
  if (patch.freqType !== undefined) {
    const freqType = normFreq(patch.freqType);
    data.freqType = freqType;
    data.daysOfWeek = freqType === "WEEKLY" ? normDays(patch.daysOfWeek) : null;
    data.timesOfDay = freqType === "HOURLY" ? null : normTimes(patch.timesOfDay);
    data.hourlyStart = freqType === "HOURLY" ? (patch.hourlyStart?.trim() || "08:00") : null;
    data.hourlyEnd = freqType === "HOURLY" ? (patch.hourlyEnd?.trim() || "22:00") : null;
  } else {
    if (patch.daysOfWeek !== undefined) data.daysOfWeek = normDays(patch.daysOfWeek);
    if (patch.timesOfDay !== undefined) data.timesOfDay = normTimes(patch.timesOfDay);
    if (patch.hourlyStart !== undefined) data.hourlyStart = patch.hourlyStart?.trim() || null;
    if (patch.hourlyEnd !== undefined) data.hourlyEnd = patch.hourlyEnd?.trim() || null;
  }

  await prisma.medicationSchedule.update({ where: { id }, data });
  revalidateMed();
}

export async function deleteMedicationSchedule(id: string): Promise<void> {
  const user = await requireAuth();
  await assertScheduleAccess(id, user.id);
  await prisma.medicationSchedule.delete({ where: { id } });
  revalidateMed();
}

/** Odhacza (lub aktualizuje) jeden slot dawki/czynności na dany dzień. */
export async function logDose(
  scheduleId: string,
  date: string,
  slot: string,
  outcome: MedicationOutcome = "TAKEN",
  note?: string | null
): Promise<void> {
  const user = await requireAuth();
  await assertScheduleAccess(scheduleId, user.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Nieprawidłowa data");
  if (!/^\d{2}:\d{2}$/.test(slot)) throw new Error("Nieprawidłowa godzina");
  await prisma.medicationLog.upsert({
    where: { scheduleId_date_slot: { scheduleId, date, slot } },
    create: { scheduleId, date, slot, outcome, note: note?.trim() || null },
    update: { outcome, takenAt: new Date(), note: note?.trim() || null },
  });
  revalidateMed();
}

/** Cofa odhaczenie slotu (toggle off). Brak wpisu = no-op. */
export async function unlogDose(scheduleId: string, date: string, slot: string): Promise<void> {
  const user = await requireAuth();
  await assertScheduleAccess(scheduleId, user.id);
  await prisma.medicationLog.deleteMany({ where: { scheduleId, date, slot } });
  revalidateMed();
}

function revalidateMed(): void {
  revalidatePath("/health/leki");
  revalidatePath("/health");
  revalidatePath("/calendar");
}
