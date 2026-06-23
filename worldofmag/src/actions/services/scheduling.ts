"use server";

// Z-213/361: akcje modułu Usługi — dostępność, pracownicy firmy, rezerwacja slotów
// (M2 + M14, wyodrębnione z actions/services.ts).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { notifyUser } from "@/actions/notifications";
import { requireOwnProvider, computeSlots } from "@/lib/services/helpers";
import type { AvailabilityRule } from "@/lib/serviceSlots";

/** Reguły dostępności bieżącego wykonawcy. */
export async function getMyAvailability(staffId?: string | null): Promise<AvailabilityRule[]> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!provider) return [];
  const rows = await prisma.serviceAvailability.findMany({
    where: { providerId: provider.id, staffId: staffId ?? null },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    select: { weekday: true, startMin: true, endMin: true },
  });
  return rows;
}

/** Zastępuje zestaw reguł dostępności wykonawcy (lub konkretnego pracownika — M14). */
export async function setAvailability(rules: AvailabilityRule[], staffId?: string | null): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  // Walidacja własności pracownika.
  if (staffId) {
    const st = await prisma.serviceStaff.findFirst({ where: { id: staffId, providerId: provider.id }, select: { id: true } });
    if (!st) throw new Error("Pracownik nie istnieje");
  }
  const sid = staffId ?? null;
  const clean = rules
    .filter((r) => r.weekday >= 0 && r.weekday <= 6 && r.startMin < r.endMin && r.startMin >= 0 && r.endMin <= 24 * 60)
    .map((r) => ({ providerId: provider.id, staffId: sid, weekday: r.weekday, startMin: r.startMin, endMin: r.endMin }));
  await prisma.$transaction([
    prisma.serviceAvailability.deleteMany({ where: { providerId: provider.id, staffId: sid } }),
    ...(clean.length ? [prisma.serviceAvailability.createMany({ data: clean })] : []),
  ]);
  revalidatePath("/services/provider");
}

export async function getMyStaff(): Promise<{ id: string; name: string; role: string | null; active: boolean }[]> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!provider) return [];
  const rows = await prisma.serviceStaff.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "asc" } });
  return rows.map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active }));
}

export async function createStaff(data: { name: string; role?: string | null }): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const name = data.name.trim();
  if (!name) throw new Error("Podaj imię pracownika");
  await prisma.serviceStaff.create({ data: { providerId: provider.id, name, role: data.role?.trim() || null } });
  revalidatePath("/services/provider");
}

export async function updateStaff(id: string, patch: { name?: string; role?: string | null; active?: boolean }): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  const st = await prisma.serviceStaff.findFirst({ where: { id, providerId: provider.id }, select: { id: true } });
  if (!st) throw new Error("Pracownik nie istnieje");
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) { const n = patch.name.trim(); if (!n) throw new Error("Podaj imię"); data.name = n; }
  if (patch.role !== undefined) data.role = patch.role?.trim() || null;
  if (patch.active !== undefined) data.active = patch.active;
  await prisma.serviceStaff.update({ where: { id }, data });
  revalidatePath("/services/provider");
}

export async function deleteStaff(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireOwnProvider(user.id);
  await prisma.serviceStaff.deleteMany({ where: { id, providerId: provider.id } });
  revalidatePath("/services/provider");
}

/** Wolne sloty (ISO) danej oferty na wskazany dzień ("YYYY-MM-DD"). M14: opcjonalnie per-pracownik. */
export async function getAvailableSlots(listingId: string, dateISO: string, opts?: { excludeRequestId?: string; staffId?: string | null }): Promise<string[]> {
  await requireAuth();
  const { slots } = await computeSlots(listingId, dateISO, opts);
  return slots;
}

/** M14: aktywni pracownicy oferty (do wyboru przy rezerwacji). Puste = firma jednoosobowa. */
export async function getListingStaff(listingId: string): Promise<{ id: string; name: string; role: string | null }[]> {
  await requireAuth();
  const listing = await prisma.serviceListing.findUnique({ where: { id: listingId }, select: { providerId: true } });
  if (!listing) return [];
  const rows = await prisma.serviceStaff.findMany({ where: { providerId: listing.providerId, active: true }, orderBy: { createdAt: "asc" } });
  return rows.map((s) => ({ id: s.id, name: s.name, role: s.role }));
}

/** Klient rezerwuje wolny slot — tworzy zlecenie od razu w statusie SCHEDULED. M14: opcjonalny pracownik. */
export async function bookSlot(listingId: string, startISO: string, staffId?: string | null): Promise<void> {
  const user = await requireAuth();
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) throw new Error("Nieprawidłowy termin");
  const dateISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  const listing = await prisma.serviceListing.findUnique({ where: { id: listingId }, select: { providerId: true } });
  if (!listing) throw new Error("Oferta nie istnieje");

  // M14: gdy firma ma pracowników, rezerwacja musi wskazać pracownika.
  const activeStaff = await prisma.serviceStaff.count({ where: { providerId: listing.providerId, active: true } });
  let sid: string | null = null;
  if (activeStaff > 0) {
    if (!staffId) throw new Error("Wybierz pracownika");
    const st = await prisma.serviceStaff.findFirst({ where: { id: staffId, providerId: listing.providerId, active: true }, select: { id: true } });
    if (!st) throw new Error("Nieprawidłowy pracownik");
    sid = staffId;
  }

  const { listingTitle, providerUserId, slots } = await computeSlots(listingId, dateISO, { staffId: sid });
  if (providerUserId === user.id) throw new Error("Nie możesz zarezerwować własnej usługi");
  if (!slots.includes(start.toISOString())) throw new Error("Ten termin jest już zajęty — odśwież i wybierz inny");

  await prisma.serviceRequest.create({
    data: {
      clientId: user.id,
      providerId: listing.providerId,
      staffId: sid,
      listingId,
      title: listingTitle,
      preferredAt: start,
      scheduledAt: start,
      status: "SCHEDULED",
    },
  });
  await notifyUser({
    userId: providerUserId,
    module: "services",
    title: `Nowa rezerwacja: ${listingTitle}`,
    body: start.toLocaleString("pl-PL"),
    href: "/services/provider",
    dedupeKey: null,
  });
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
}
