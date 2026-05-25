"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import { assertPetAccess } from "@/actions/pets";
import { computeNextDue, parseRecurringRule } from "@/lib/recurrence";
import { buildAgenda, buildWelfareSuggestions, type AgendaSource } from "@/lib/petWelfare";
import type {
  PetTreatment, PetCareTask, PetVetVisit, PetMeasurement, PetHealthRecord, PetCareLog,
  PetTreatmentKind, PetCareCategory, PetHealthType, RecurringRule,
  CareAgendaItem, WelfareSuggestion,
} from "@/types";

function revalidatePet(petId: string) {
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets/calendar");
}

/** Compute next due date from a rule string, respecting endDate. */
function nextDueFrom(base: Date, rule: RecurringRule | null): Date | null {
  if (!rule) return null;
  const next = computeNextDue(base, rule);
  if (!next) return null;
  if (rule.endDate && next > new Date(rule.endDate)) return null;
  return next;
}

async function accessiblePetIds(userId: string): Promise<string[]> {
  const teamIds = await getUserTeamIds(userId);
  const pets = await prisma.pet.findMany({
    where: {
      OR: [
        { ownerId: userId },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
        { shares: { some: { userId } } },
        ...(teamIds.length > 0 ? [{ shares: { some: { teamId: { in: teamIds } } } }] : []),
      ],
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return pets.map((p) => p.id);
}

// ─── Treatments (leki / szczepienia / odrobaczanie / suplementy) ────────────

export async function createTreatment(petId: string, data: {
  kind?: PetTreatmentKind;
  name: string;
  dosage?: string | null;
  route?: string | null;
  batch?: string | null;
  startDate?: Date;
  endDate?: Date | null;
  recurring?: RecurringRule | null;
  nextDueAt?: Date | null;
  notes?: string | null;
}): Promise<PetTreatment> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);

  const start = data.startDate ?? new Date();
  const nextDueAt = data.nextDueAt ?? (data.recurring ? start : null);

  const t = await prisma.petTreatment.create({
    data: {
      petId,
      kind: data.kind ?? "MEDICATION",
      name: data.name.trim(),
      dosage: data.dosage ?? null,
      route: data.route ?? null,
      batch: data.batch ?? null,
      startDate: start,
      endDate: data.endDate ?? null,
      recurring: data.recurring ? JSON.stringify(data.recurring) : null,
      nextDueAt,
      notes: data.notes ?? null,
    },
  });

  void trackActivity("pets", "create_treatment", { petId, kind: t.kind, name: t.name });
  revalidatePet(petId);
  return t as PetTreatment;
}

export async function updateTreatment(id: string, patch: Partial<{
  kind: PetTreatmentKind; name: string; dosage: string | null; route: string | null;
  batch: string | null; startDate: Date; endDate: Date | null; recurring: RecurringRule | null;
  nextDueAt: Date | null; active: boolean; notes: string | null;
}>): Promise<PetTreatment> {
  const user = await requireAuth();
  const existing = await prisma.petTreatment.findUnique({ where: { id } });
  if (!existing) throw new Error("Nie znaleziono pozycji");
  await assertPetAccess(existing.petId, user.id, true);

  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();
  if (patch.recurring !== undefined) data.recurring = patch.recurring ? JSON.stringify(patch.recurring) : null;

  const t = await prisma.petTreatment.update({ where: { id }, data });
  revalidatePet(existing.petId);
  return t as PetTreatment;
}

export async function completeTreatment(id: string, occurredAt?: Date, note?: string): Promise<PetTreatment> {
  const user = await requireAuth();
  const existing = await prisma.petTreatment.findUnique({ where: { id } });
  if (!existing) throw new Error("Nie znaleziono pozycji");
  await assertPetAccess(existing.petId, user.id, true);

  const when = occurredAt ?? new Date();
  const rule = parseRecurringRule(existing.recurring);
  const base = existing.nextDueAt ?? when;
  const nextDueAt = nextDueFrom(base, rule);

  await prisma.petCareLog.create({
    data: { petId: existing.petId, treatmentId: id, category: existing.kind, occurredAt: when, note: note ?? null },
  });

  const t = await prisma.petTreatment.update({
    where: { id },
    data: { lastDoneAt: when, nextDueAt },
  });

  void trackActivity("pets", "complete_treatment", { petId: existing.petId, name: existing.name });
  revalidatePet(existing.petId);
  return t as PetTreatment;
}

export async function deleteTreatment(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.petTreatment.findUnique({ where: { id } });
  if (!existing) return;
  await assertPetAccess(existing.petId, user.id, true);
  await prisma.petTreatment.delete({ where: { id } });
  revalidatePet(existing.petId);
}

// ─── Care tasks (rutyny: karmienie, czyszczenie, pielęgnacja…) ──────────────

export async function createCareTask(petId: string, data: {
  category?: PetCareCategory;
  title: string;
  details?: Record<string, unknown> | null;
  recurring?: RecurringRule | null;
  nextDueAt?: Date | null;
}): Promise<PetCareTask> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);

  const nextDueAt = data.nextDueAt ?? (data.recurring ? new Date() : null);
  const c = await prisma.petCareTask.create({
    data: {
      petId,
      category: data.category ?? "CUSTOM",
      title: data.title.trim(),
      details: data.details ? JSON.stringify(data.details) : null,
      recurring: data.recurring ? JSON.stringify(data.recurring) : null,
      nextDueAt,
    },
  });

  void trackActivity("pets", "create_care_task", { petId, category: c.category, title: c.title });
  revalidatePet(petId);
  return c as PetCareTask;
}

export async function updateCareTask(id: string, patch: Partial<{
  category: PetCareCategory; title: string; details: Record<string, unknown> | null;
  recurring: RecurringRule | null; nextDueAt: Date | null; active: boolean;
}>): Promise<PetCareTask> {
  const user = await requireAuth();
  const existing = await prisma.petCareTask.findUnique({ where: { id } });
  if (!existing) throw new Error("Nie znaleziono pozycji");
  await assertPetAccess(existing.petId, user.id, true);

  const data: Record<string, unknown> = { ...patch };
  if (patch.title) data.title = patch.title.trim();
  if (patch.details !== undefined) data.details = patch.details ? JSON.stringify(patch.details) : null;
  if (patch.recurring !== undefined) data.recurring = patch.recurring ? JSON.stringify(patch.recurring) : null;

  const c = await prisma.petCareTask.update({ where: { id }, data });
  revalidatePet(existing.petId);
  return c as PetCareTask;
}

export async function completeCareTask(id: string, occurredAt?: Date, payload?: Record<string, unknown>, note?: string): Promise<PetCareTask> {
  const user = await requireAuth();
  const existing = await prisma.petCareTask.findUnique({ where: { id } });
  if (!existing) throw new Error("Nie znaleziono pozycji");
  await assertPetAccess(existing.petId, user.id, true);

  const when = occurredAt ?? new Date();
  const rule = parseRecurringRule(existing.recurring);
  const base = existing.nextDueAt ?? when;
  const nextDueAt = nextDueFrom(base, rule);

  await prisma.petCareLog.create({
    data: {
      petId: existing.petId, careTaskId: id, category: existing.category, occurredAt: when,
      payload: payload ? JSON.stringify(payload) : null, note: note ?? null,
    },
  });

  const c = await prisma.petCareTask.update({ where: { id }, data: { lastDoneAt: when, nextDueAt } });
  void trackActivity("pets", "complete_care_task", { petId: existing.petId, title: existing.title });
  revalidatePet(existing.petId);
  return c as PetCareTask;
}

export async function deleteCareTask(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.petCareTask.findUnique({ where: { id } });
  if (!existing) return;
  await assertPetAccess(existing.petId, user.id, true);
  await prisma.petCareTask.delete({ where: { id } });
  revalidatePet(existing.petId);
}

/** Szybki wpis karmienia (log + ewentualnie odhaczenie harmonogramu FEEDING). */
export async function logFeeding(petId: string, data: {
  foodType?: string | null; amount?: string | null; preyType?: string | null;
  outcome?: "FED" | "REFUSED" | "REGURGITATED"; occurredAt?: Date; note?: string | null;
}): Promise<PetCareLog> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);

  const payload = {
    foodType: data.foodType ?? null,
    amount: data.amount ?? null,
    preyType: data.preyType ?? null,
    outcome: data.outcome ?? "FED",
  };
  const log = await prisma.petCareLog.create({
    data: {
      petId, category: "FEEDING", occurredAt: data.occurredAt ?? new Date(),
      payload: JSON.stringify(payload), note: data.note ?? null,
    },
  });

  void trackActivity("pets", "log_feeding", { petId, outcome: payload.outcome });
  revalidatePet(petId);
  return log as PetCareLog;
}

// ─── Vet visits ─────────────────────────────────────────────────────────────

export async function createVetVisit(petId: string, data: {
  date: Date; vetName?: string | null; clinic?: string | null; reason?: string | null;
  diagnosis?: string | null; cost?: number | null; nextVisitAt?: Date | null;
  attachmentUrl?: string | null; notes?: string | null;
}): Promise<PetVetVisit> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);
  const v = await prisma.petVetVisit.create({
    data: {
      petId, date: data.date, vetName: data.vetName ?? null, clinic: data.clinic ?? null,
      reason: data.reason ?? null, diagnosis: data.diagnosis ?? null, cost: data.cost ?? null,
      nextVisitAt: data.nextVisitAt ?? null, attachmentUrl: data.attachmentUrl ?? null, notes: data.notes ?? null,
    },
  });
  void trackActivity("pets", "create_vet_visit", { petId });
  revalidatePet(petId);
  return v as PetVetVisit;
}

export async function updateVetVisit(id: string, patch: Partial<{
  date: Date; vetName: string | null; clinic: string | null; reason: string | null;
  diagnosis: string | null; cost: number | null; nextVisitAt: Date | null;
  attachmentUrl: string | null; notes: string | null;
}>): Promise<PetVetVisit> {
  const user = await requireAuth();
  const existing = await prisma.petVetVisit.findUnique({ where: { id } });
  if (!existing) throw new Error("Nie znaleziono wizyty");
  await assertPetAccess(existing.petId, user.id, true);
  const v = await prisma.petVetVisit.update({ where: { id }, data: patch });
  revalidatePet(existing.petId);
  return v as PetVetVisit;
}

export async function deleteVetVisit(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.petVetVisit.findUnique({ where: { id } });
  if (!existing) return;
  await assertPetAccess(existing.petId, user.id, true);
  await prisma.petVetVisit.delete({ where: { id } });
  revalidatePet(existing.petId);
}

// ─── Measurements ─────────────────────────────────────────────────────────

export async function addMeasurement(petId: string, data: {
  date?: Date; weightGrams?: number | null; lengthCm?: number | null; bodyScore?: number | null; note?: string | null;
}): Promise<PetMeasurement> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);
  const m = await prisma.petMeasurement.create({
    data: {
      petId, date: data.date ?? new Date(), weightGrams: data.weightGrams ?? null,
      lengthCm: data.lengthCm ?? null, bodyScore: data.bodyScore ?? null, note: data.note ?? null,
    },
  });
  void trackActivity("pets", "add_measurement", { petId, weightGrams: m.weightGrams });
  revalidatePet(petId);
  return m as PetMeasurement;
}

export async function deleteMeasurement(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.petMeasurement.findUnique({ where: { id } });
  if (!existing) return;
  await assertPetAccess(existing.petId, user.id, true);
  await prisma.petMeasurement.delete({ where: { id } });
  revalidatePet(existing.petId);
}

// ─── Health records ─────────────────────────────────────────────────────────

export async function createHealthRecord(petId: string, data: {
  type?: PetHealthType; title: string; description?: string | null; date?: Date; resolved?: boolean;
}): Promise<PetHealthRecord> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);
  const h = await prisma.petHealthRecord.create({
    data: {
      petId, type: data.type ?? "NOTE", title: data.title.trim(),
      description: data.description ?? null, date: data.date ?? new Date(), resolved: data.resolved ?? false,
    },
  });
  void trackActivity("pets", "create_health_record", { petId, type: h.type });
  revalidatePet(petId);
  return h as PetHealthRecord;
}

export async function updateHealthRecord(id: string, patch: Partial<{
  type: PetHealthType; title: string; description: string | null; date: Date; resolved: boolean;
}>): Promise<PetHealthRecord> {
  const user = await requireAuth();
  const existing = await prisma.petHealthRecord.findUnique({ where: { id } });
  if (!existing) throw new Error("Nie znaleziono wpisu");
  await assertPetAccess(existing.petId, user.id, true);
  const data: Record<string, unknown> = { ...patch };
  if (patch.title) data.title = patch.title.trim();
  const h = await prisma.petHealthRecord.update({ where: { id }, data });
  revalidatePet(existing.petId);
  return h as PetHealthRecord;
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.petHealthRecord.findUnique({ where: { id } });
  if (!existing) return;
  await assertPetAccess(existing.petId, user.id, true);
  await prisma.petHealthRecord.delete({ where: { id } });
  revalidatePet(existing.petId);
}

// ─── History & agenda ─────────────────────────────────────────────────────

export async function getCareHistory(petId: string, limit = 100): Promise<PetCareLog[]> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id);
  const logs = await prisma.petCareLog.findMany({
    where: { petId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  return logs as PetCareLog[];
}

/** Buduje zunifikowaną agendę opieki ze wszystkich dostępnych zwierząt. */
export async function getCareAgenda(): Promise<CareAgendaItem[]> {
  const user = await requireAuth();
  const petIds = await accessiblePetIds(user.id);
  if (petIds.length === 0) return [];

  const [pets, treatments, careTasks, vetVisits] = await Promise.all([
    prisma.pet.findMany({ where: { id: { in: petIds } }, select: { id: true, name: true, species: true } }),
    prisma.petTreatment.findMany({ where: { petId: { in: petIds }, active: true, nextDueAt: { not: null } } }),
    prisma.petCareTask.findMany({ where: { petId: { in: petIds }, active: true, nextDueAt: { not: null } } }),
    prisma.petVetVisit.findMany({ where: { petId: { in: petIds }, nextVisitAt: { not: null } } }),
  ]);

  const source: AgendaSource = { pets, treatments, careTasks, vetVisits };
  return buildAgenda(source, new Date());
}

/** Dane dla strony domowej działu: agenda + sugestie dobrostanu (warstwa reguł). */
export async function getPetWelfare(): Promise<{ agenda: CareAgendaItem[]; suggestions: WelfareSuggestion[] }> {
  const user = await requireAuth();
  const petIds = await accessiblePetIds(user.id);
  if (petIds.length === 0) return { agenda: [], suggestions: [] };

  const now = new Date();
  const [pets, treatments, careTasks, vetVisits, measurements] = await Promise.all([
    prisma.pet.findMany({ where: { id: { in: petIds } }, select: { id: true, name: true, species: true, presetKey: true, featureFlags: true } }),
    prisma.petTreatment.findMany({ where: { petId: { in: petIds }, active: true, nextDueAt: { not: null } } }),
    prisma.petCareTask.findMany({ where: { petId: { in: petIds }, active: true, nextDueAt: { not: null } } }),
    prisma.petVetVisit.findMany({ where: { petId: { in: petIds }, nextVisitAt: { not: null } } }),
    prisma.petMeasurement.findMany({ where: { petId: { in: petIds } }, orderBy: { date: "desc" } }),
  ]);

  const source: AgendaSource = { pets, treatments, careTasks, vetVisits };
  const agenda = buildAgenda(source, now);
  const suggestions = buildWelfareSuggestions({ pets, measurements }, now);
  return { agenda, suggestions };
}
