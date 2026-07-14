"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds, getAccessibleTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import { assertPetAccess } from "@/actions/pets";
import { notifyUser } from "@/actions/notifications";
import { ENV_PARAMS, classifyValue, rangeLabel, type Range } from "@/lib/petEnvironment";
import type { PetEnclosure, PetEnvironmentReading } from "@/types";

async function assertEnclosureAccess(enclosureId: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const enc = await prisma.petEnclosure.findUnique({
    where: { id: enclosureId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!enc) throw new Error("Zbiornik nie istnieje");
  if (enc.ownerId === userId) return;
  if (enc.ownerTeamId && teamIds.includes(enc.ownerTeamId)) return;
  throw new Error("Brak dostępu do zbiornika");
}

export async function getEnclosures(): Promise<PetEnclosure[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "pets");
  const list = await prisma.petEnclosure.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  return list as PetEnclosure[];
}

export async function createEnclosure(data: {
  name: string;
  type?: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  volumeL?: number | null;
  location?: string | null;
  equipment?: unknown[] | null;
  targetRanges?: Record<string, unknown> | null;
  notes?: string | null;
  ownerTeamId?: string | null;
  assignPetId?: string | null;
}): Promise<PetEnclosure> {
  const user = await requireAuth();
  if (data.ownerTeamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "pets");
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego zespołu");
  }

  const enc = await prisma.petEnclosure.create({
    data: {
      name: data.name.trim(),
      type: data.type ?? "TERRARIUM",
      lengthCm: data.lengthCm ?? null,
      widthCm: data.widthCm ?? null,
      heightCm: data.heightCm ?? null,
      volumeL: data.volumeL ?? null,
      location: data.location ?? null,
      equipment: data.equipment ? JSON.stringify(data.equipment) : null,
      targetRanges: data.targetRanges ? JSON.stringify(data.targetRanges) : null,
      notes: data.notes ?? null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
    },
  });

  if (data.assignPetId) {
    await assertPetAccess(data.assignPetId, user.id, true);
    await prisma.pet.update({ where: { id: data.assignPetId }, data: { enclosureId: enc.id } });
    revalidatePath(`/pets/${data.assignPetId}`);
  }

  void trackActivity("pets", "create_enclosure", { name: enc.name, type: enc.type });
  revalidatePath("/pets");
  return enc as PetEnclosure;
}

export async function updateEnclosure(id: string, patch: Partial<{
  name: string; type: string; lengthCm: number | null; widthCm: number | null;
  heightCm: number | null; volumeL: number | null; location: string | null;
  equipment: unknown[] | null; targetRanges: Record<string, unknown> | null; notes: string | null;
}>): Promise<PetEnclosure> {
  const user = await requireAuth();
  await assertEnclosureAccess(id, user.id);

  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();
  if (patch.equipment !== undefined) data.equipment = patch.equipment ? JSON.stringify(patch.equipment) : null;
  if (patch.targetRanges !== undefined) data.targetRanges = patch.targetRanges ? JSON.stringify(patch.targetRanges) : null;

  const enc = await prisma.petEnclosure.update({ where: { id }, data });
  revalidatePath("/pets");
  return enc as PetEnclosure;
}

export async function deleteEnclosure(id: string): Promise<void> {
  const user = await requireAuth();
  await assertEnclosureAccess(id, user.id);
  await prisma.petEnclosure.delete({ where: { id } });
  revalidatePath("/pets");
}

export async function assignPetToEnclosure(petId: string, enclosureId: string | null): Promise<void> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);
  if (enclosureId) await assertEnclosureAccess(enclosureId, user.id);
  await prisma.pet.update({ where: { id: petId }, data: { enclosureId } });
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
}

export async function addEnvironmentReading(enclosureId: string, data: {
  measuredAt?: Date;
  tempWarmC?: number | null; tempCoolC?: number | null; humidityPct?: number | null; uvbIndex?: number | null;
  waterTempC?: number | null; ph?: number | null; ammoniaPpm?: number | null; nitritePpm?: number | null;
  nitratePpm?: number | null; salinityPpt?: number | null; gh?: number | null; kh?: number | null;
  note?: string | null;
}): Promise<PetEnvironmentReading> {
  const user = await requireAuth();
  await assertEnclosureAccess(enclosureId, user.id);

  const reading = await prisma.petEnvironmentReading.create({
    data: {
      enclosureId,
      measuredAt: data.measuredAt ?? new Date(),
      tempWarmC: data.tempWarmC ?? null, tempCoolC: data.tempCoolC ?? null,
      humidityPct: data.humidityPct ?? null, uvbIndex: data.uvbIndex ?? null,
      waterTempC: data.waterTempC ?? null, ph: data.ph ?? null,
      ammoniaPpm: data.ammoniaPpm ?? null, nitritePpm: data.nitritePpm ?? null,
      nitratePpm: data.nitratePpm ?? null, salinityPpt: data.salinityPpt ?? null,
      gh: data.gh ?? null, kh: data.kh ?? null, note: data.note ?? null,
    },
  });

  // P2: alert, gdy parametr poza zakresem bezpieczeństwa (silnik powiadomień NM3).
  await alertOutOfRange(enclosureId, reading, user.id);

  void trackActivity("pets", "add_environment_reading", { enclosureId });
  revalidatePath("/pets");
  return reading as PetEnvironmentReading;
}

/** P2: klasyfikuje wartości odczytu względem zakresów zbiornika i powiadamia o przekroczeniach. */
async function alertOutOfRange(
  enclosureId: string,
  reading: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const enc = await prisma.petEnclosure.findUnique({
    where: { id: enclosureId },
    select: { name: true, targetRanges: true },
  });
  if (!enc) return;

  let custom: Record<string, Range> | null = null;
  if (enc.targetRanges) {
    try { custom = JSON.parse(enc.targetRanges) as Record<string, Range>; } catch { custom = null; }
  }

  const offenders: { label: string; text: string; danger: boolean }[] = [];
  for (const p of ENV_PARAMS) {
    const value = reading[p.key] as number | null | undefined;
    if (value == null) continue;
    const status = classifyValue(p.key, value, custom);
    if (status === "ok") continue;
    const val = `${value}${p.unit ? ` ${p.unit}` : ""}`;
    const goal = rangeLabel(p.key, custom);
    offenders.push({ label: p.label, text: `${p.label}: ${val}${goal ? ` (${goal})` : ""}`, danger: status === "danger" });
  }
  if (offenders.length === 0) return;

  const anyDanger = offenders.some((o) => o.danger);
  const icon = anyDanger ? "🔴" : "🟠";
  const title = offenders.length === 1
    ? `${icon} ${enc.name}: ${offenders[0].label} poza zakresem`
    : `${icon} ${enc.name}: ${offenders.length} parametry poza zakresem`;
  const body = offenders.map((o) => o.text).join(" · ");

  // dedupeKey per zbiornik + dzień — jedno przypomnienie dziennie, body z aktualnymi przekroczeniami.
  const day = new Date().toISOString().slice(0, 10);
  await notifyUser({
    userId,
    module: "pets",
    title,
    body,
    href: "/pets",
    dedupeKey: `pet-env-${enclosureId}-${day}`,
  });
}

export async function deleteEnvironmentReading(id: string): Promise<void> {
  const user = await requireAuth();
  const reading = await prisma.petEnvironmentReading.findUnique({ where: { id }, select: { enclosureId: true } });
  if (!reading) return;
  await assertEnclosureAccess(reading.enclosureId, user.id);
  await prisma.petEnvironmentReading.delete({ where: { id } });
  revalidatePath("/pets");
}
