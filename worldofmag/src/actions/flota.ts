"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import type { Vehicle, FuelLog, ServiceRecord } from "@prisma/client";

export type VehicleAttachmentDTO = { id: string; name: string; url: string; createdAt: Date };
export type VehicleWithStats = Vehicle & { fuelLogs: FuelLog[]; services: ServiceRecord[]; attachments?: VehicleAttachmentDTO[] };

async function ownershipFilter(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return { OR: [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] };
}

async function assertVehicleAccess(vehicleId: string, userId: string): Promise<Vehicle> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Pojazd nie istnieje");
  if (vehicle.ownerId === userId) return vehicle;
  if (vehicle.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (teamIds.includes(vehicle.ownerTeamId)) return vehicle;
  }
  throw new Error("Brak dostępu do pojazdu");
}

export async function getVehicles(): Promise<VehicleWithStats[]> {
  const user = await requireAuth();
  const where = await ownershipFilter(user.id);
  return prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      fuelLogs: { orderBy: { date: "asc" } },
      services: { orderBy: { date: "desc" } },
    },
  });
}

export async function getVehicle(id: string): Promise<VehicleWithStats | null> {
  const user = await requireAuth();
  await assertVehicleAccess(id, user.id);
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      fuelLogs: { orderBy: { date: "asc" } },
      services: { orderBy: { date: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createVehicle(data: {
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  fuelType?: string;
  odometer?: number;
  inspectionDue?: Date | null;
  insuranceDue?: Date | null;
  notes?: string | null;
  ownerTeamId?: string | null;
}): Promise<Vehicle> {
  const user = await requireAuth();
  const name = data.name?.trim();
  if (!name) throw new Error("Nazwa pojazdu jest wymagana");

  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      name,
      make: data.make?.trim() || null,
      model: data.model?.trim() || null,
      year: data.year ?? null,
      plate: data.plate?.trim() || null,
      fuelType: data.fuelType ?? "petrol",
      odometer: data.odometer ?? 0,
      inspectionDue: data.inspectionDue ?? null,
      insuranceDue: data.insuranceDue ?? null,
      notes: data.notes?.trim() || null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
    },
  });
  void trackActivity("flota", "create_vehicle", { name });
  revalidatePath("/flota");
  return vehicle;
}

export async function updateVehicle(
  id: string,
  patch: Partial<{
    name: string;
    make: string | null;
    model: string | null;
    year: number | null;
    plate: string | null;
    fuelType: string;
    odometer: number;
    inspectionDue: Date | null;
    insuranceDue: Date | null;
    notes: string | null;
  }>,
): Promise<Vehicle> {
  const user = await requireAuth();
  await assertVehicleAccess(id, user.id);
  const vehicle = await prisma.vehicle.update({ where: { id }, data: patch });
  revalidatePath("/flota");
  revalidatePath(`/flota/${id}`);
  return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const user = await requireAuth();
  await assertVehicleAccess(id, user.id);
  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/flota");
}

export async function addFuelLog(
  vehicleId: string,
  data: { date?: Date | null; odometer: number; liters: number; totalCost?: number | null; full?: boolean; note?: string | null },
): Promise<FuelLog> {
  const user = await requireAuth();
  await assertVehicleAccess(vehicleId, user.id);
  const log = await prisma.fuelLog.create({
    data: {
      vehicleId,
      date: data.date ?? new Date(),
      odometer: data.odometer,
      liters: data.liters,
      totalCost: data.totalCost ?? null,
      full: data.full ?? true,
      note: data.note?.trim() || null,
    },
  });
  // Aktualizuj bieżący przebieg, jeśli tankowanie nowsze.
  await prisma.vehicle.updateMany({
    where: { id: vehicleId, odometer: { lt: data.odometer } },
    data: { odometer: data.odometer },
  });
  void trackActivity("flota", "add_fuel", { vehicleId, liters: data.liters });
  revalidatePath(`/flota/${vehicleId}`);
  revalidatePath("/flota");
  return log;
}

export async function deleteFuelLog(id: string): Promise<void> {
  const user = await requireAuth();
  const log = await prisma.fuelLog.findUnique({ where: { id } });
  if (!log) return;
  await assertVehicleAccess(log.vehicleId, user.id);
  await prisma.fuelLog.delete({ where: { id } });
  revalidatePath(`/flota/${log.vehicleId}`);
}

export async function addServiceRecord(
  vehicleId: string,
  data: { date?: Date | null; odometer?: number | null; type?: string; cost?: number | null; note?: string | null },
): Promise<ServiceRecord> {
  const user = await requireAuth();
  await assertVehicleAccess(vehicleId, user.id);
  const rec = await prisma.serviceRecord.create({
    data: {
      vehicleId,
      date: data.date ?? new Date(),
      odometer: data.odometer ?? null,
      type: data.type ?? "other",
      cost: data.cost ?? null,
      note: data.note?.trim() || null,
    },
  });
  void trackActivity("flota", "add_service", { vehicleId, type: data.type ?? "other" });
  revalidatePath(`/flota/${vehicleId}`);
  return rec;
}

export async function deleteServiceRecord(id: string): Promise<void> {
  const user = await requireAuth();
  const rec = await prisma.serviceRecord.findUnique({ where: { id } });
  if (!rec) return;
  await assertVehicleAccess(rec.vehicleId, user.id);
  await prisma.serviceRecord.delete({ where: { id } });
  revalidatePath(`/flota/${rec.vehicleId}`);
}

// ─── F3 załączniki pojazdu ──────────────────────────────────────────────────

export async function addVehicleAttachment(vehicleId: string, name: string, url: string): Promise<void> {
  const user = await requireAuth();
  await assertVehicleAccess(vehicleId, user.id);
  const n = name.trim() || "Załącznik";
  if (!url || (!url.startsWith("data:") && !url.startsWith("http"))) throw new Error("Nieprawidłowy plik");
  if (url.length > 3_500_000) throw new Error("Plik jest za duży (max ~2,5 MB)");
  await prisma.vehicleAttachment.create({ data: { vehicleId, name: n, url } });
  revalidatePath(`/flota/${vehicleId}`);
}

export async function deleteVehicleAttachment(id: string): Promise<void> {
  const user = await requireAuth();
  const att = await prisma.vehicleAttachment.findUnique({ where: { id }, select: { vehicleId: true } });
  if (!att) throw new Error("Załącznik nie istnieje");
  await assertVehicleAccess(att.vehicleId, user.id);
  await prisma.vehicleAttachment.delete({ where: { id } });
  revalidatePath(`/flota/${att.vehicleId}`);
}
