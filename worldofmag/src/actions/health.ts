"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import type { HealthEvent, HealthKind, HealthStatus } from "@/types";

function safeDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

async function assertEventAccess(id: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const ev = await prisma.healthEvent.findUnique({
    where: { id },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!ev) throw new Error("Wpis nie istnieje");
  if (ev.ownerId === userId) return;
  if (ev.ownerTeamId && teamIds.includes(ev.ownerTeamId)) return;
  throw new Error("Brak dostępu do wpisu");
}

export async function getHealthEvents(filter?: {
  kind?: HealthKind;
  scope?: "upcoming" | "past" | "all";
}): Promise<HealthEvent[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const where: Record<string, unknown> = {
    OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])],
  };
  if (filter?.kind) where.kind = filter.kind;

  // Granica „dziś" — od północy lokalnej traktujemy jako nadchodzące.
  if (filter?.scope === "upcoming") {
    where.scheduledAt = { gte: startOfToday() };
    where.status = { not: "CANCELLED" };
  } else if (filter?.scope === "past") {
    where.scheduledAt = { lt: startOfToday() };
  }

  const events = await prisma.healthEvent.findMany({
    where,
    orderBy: { scheduledAt: filter?.scope === "past" ? "desc" : "asc" },
  });
  return events as HealthEvent[];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function createHealthEvent(data: {
  kind: HealthKind;
  title: string;
  scheduledAt: Date | string;
  doctorName?: string | null;
  specialty?: string | null;
  facility?: string | null;
  location?: string | null;
  notes?: string | null;
  result?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  referral?: string | null;
  reminderAt?: Date | string | null;
  ownerTeamId?: string | null;
}): Promise<HealthEvent> {
  const user = await requireAuth();
  const title = data.title.trim();
  const scheduledAt = safeDate(data.scheduledAt);
  if (!title) throw new Error("Tytuł jest wymagany");
  if (!scheduledAt) throw new Error("Termin jest wymagany");

  let ownerTeamId: string | null = null;
  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
    ownerTeamId = data.ownerTeamId;
  }

  const ev = await prisma.healthEvent.create({
    data: {
      kind: data.kind === "TEST" ? "TEST" : "VISIT",
      title,
      scheduledAt,
      doctorName: data.doctorName?.trim() || null,
      specialty: data.specialty?.trim() || null,
      facility: data.facility?.trim() || null,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
      result: data.result?.trim() || null,
      numericValue: data.numericValue ?? null,
      unit: data.unit?.trim() || null,
      referral: data.referral?.trim() || null,
      reminderAt: safeDate(data.reminderAt),
      ownerId: ownerTeamId ? null : user.id,
      ownerTeamId,
    },
  });
  revalidatePath("/health");
  return ev as HealthEvent;
}

export async function updateHealthEvent(
  id: string,
  patch: {
    kind?: HealthKind;
    title?: string;
    scheduledAt?: Date | string;
    doctorName?: string | null;
    specialty?: string | null;
    facility?: string | null;
    location?: string | null;
    status?: HealthStatus;
    notes?: string | null;
    result?: string | null;
    numericValue?: number | null;
    unit?: string | null;
    referral?: string | null;
    reminderAt?: Date | string | null;
  }
): Promise<void> {
  const user = await requireAuth();
  await assertEventAccess(id, user.id);

  const data: Record<string, unknown> = {};
  if (patch.kind !== undefined) data.kind = patch.kind === "TEST" ? "TEST" : "VISIT";
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.scheduledAt !== undefined) {
    const dt = safeDate(patch.scheduledAt);
    if (dt) data.scheduledAt = dt;
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.doctorName !== undefined) data.doctorName = patch.doctorName?.trim() || null;
  if (patch.specialty !== undefined) data.specialty = patch.specialty?.trim() || null;
  if (patch.facility !== undefined) data.facility = patch.facility?.trim() || null;
  if (patch.location !== undefined) data.location = patch.location?.trim() || null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.result !== undefined) data.result = patch.result?.trim() || null;
  if (patch.numericValue !== undefined) data.numericValue = patch.numericValue;
  if (patch.unit !== undefined) data.unit = patch.unit?.trim() || null;
  if (patch.referral !== undefined) data.referral = patch.referral?.trim() || null;
  if (patch.reminderAt !== undefined) data.reminderAt = safeDate(patch.reminderAt);

  await prisma.healthEvent.update({ where: { id }, data });
  revalidatePath("/health");
}

export async function setHealthStatus(id: string, status: HealthStatus): Promise<void> {
  const user = await requireAuth();
  await assertEventAccess(id, user.id);
  await prisma.healthEvent.update({ where: { id }, data: { status } });
  revalidatePath("/health");
}

export async function deleteHealthEvent(id: string): Promise<void> {
  const user = await requireAuth();
  await assertEventAccess(id, user.id);
  await prisma.healthEvent.delete({ where: { id } });
  revalidatePath("/health");
}

export type TestTrend = {
  title: string;
  unit: string | null;
  points: { date: string; value: number }[];
};

/** Z2: trendy badań — grupuje badania (TEST) z wartością liczbową po nazwie, rosnąco wg daty. */
export async function getTestTrends(): Promise<TestTrend[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);
  const rows = await prisma.healthEvent.findMany({
    where: {
      kind: "TEST",
      numericValue: { not: null },
      OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])],
    },
    orderBy: { scheduledAt: "asc" },
    select: { title: true, unit: true, numericValue: true, scheduledAt: true },
  });

  const map = new Map<string, TestTrend>();
  for (const r of rows) {
    const key = r.title.trim().toLowerCase();
    let t = map.get(key);
    if (!t) { t = { title: r.title.trim(), unit: r.unit, points: [] }; map.set(key, t); }
    if (!t.unit && r.unit) t.unit = r.unit;
    t.points.push({ date: r.scheduledAt.toISOString(), value: r.numericValue as number });
  }
  // Tylko serie z co najmniej 2 pomiarami mają sens jako trend.
  return Array.from(map.values()).filter((t) => t.points.length >= 2);
}

// ─── Z1 załączniki wyników ──────────────────────────────────────────────────

export type HealthAttachmentDTO = { id: string; name: string; url: string; createdAt: string };

export async function getHealthAttachments(eventId: string): Promise<HealthAttachmentDTO[]> {
  const user = await requireAuth();
  await assertEventAccess(eventId, user.id);
  const rows = await prisma.healthAttachment.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } });
  return rows.map((a) => ({ id: a.id, name: a.name, url: a.url, createdAt: a.createdAt.toISOString() }));
}

export async function addHealthAttachment(eventId: string, name: string, url: string): Promise<void> {
  const user = await requireAuth();
  await assertEventAccess(eventId, user.id);
  const n = name.trim() || "Wynik";
  if (!url || (!url.startsWith("data:") && !url.startsWith("http"))) throw new Error("Nieprawidłowy plik");
  if (url.length > 3_500_000) throw new Error("Plik jest za duży (max ~2,5 MB)");
  await prisma.healthAttachment.create({ data: { eventId, name: n, url } });
  revalidatePath("/health");
}

export async function deleteHealthAttachment(id: string): Promise<void> {
  const user = await requireAuth();
  const att = await prisma.healthAttachment.findUnique({ where: { id }, select: { eventId: true } });
  if (!att) throw new Error("Załącznik nie istnieje");
  await assertEventAccess(att.eventId, user.id);
  await prisma.healthAttachment.delete({ where: { id } });
  revalidatePath("/health");
}
