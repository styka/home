"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds, getAccessibleTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import { assertPetAccess } from "@/actions/pets";
import type { PetBreedingData, PetBreedingPair, PetClutch, PetSale, PetStatus } from "@/types";
import type { PetGene } from "@/lib/petGenetics";

const PET_REF = { id: true, name: true, species: true, sex: true, status: true } as const;

async function assertPairAccess(pairId: string, userId: string): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const pair = await prisma.petBreedingPair.findUnique({ where: { id: pairId }, select: { ownerId: true, ownerTeamId: true } });
  if (!pair) throw new Error("Para hodowlana nie istnieje");
  if (pair.ownerId === userId) return;
  if (pair.ownerTeamId && teamIds.includes(pair.ownerTeamId)) return;
  throw new Error("Brak dostępu do pary hodowlanej");
}

function revalidatePet(petId: string) {
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
}

// ─── Rodowód, genetyka, dane zakładek ───────────────────────────────────────

export async function getPetBreeding(petId: string): Promise<PetBreedingData> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id);
  const teamIds = await getAccessibleTeamIds(user.id, "pets");

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: {
      genetics: true, species: true,
      sire: { select: PET_REF },
      dam: { select: PET_REF },
      offspringAsSire: { select: PET_REF },
      offspringAsDam: { select: PET_REF },
    },
  });
  if (!pet) throw new Error("Zwierzę nie istnieje");

  const [pairs, sales, candidatesRaw] = await Promise.all([
    prisma.petBreedingPair.findMany({
      where: { OR: [{ maleId: petId }, { femaleId: petId }] },
      include: { male: { select: PET_REF }, female: { select: PET_REF }, clutches: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.petSale.findMany({ where: { petId }, orderBy: { soldAt: "desc" } }),
    prisma.pet.findMany({
      where: {
        species: pet.species,
        id: { not: petId },
        OR: [
          { ownerId: user.id },
          ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
          { shares: { some: { userId: user.id } } },
        ],
      },
      select: { id: true, name: true, species: true, sex: true, status: true, genetics: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const offspringMap = new Map<string, { id: string; name: string; species: string; sex: string | null; status: string }>();
  for (const o of [...pet.offspringAsSire, ...pet.offspringAsDam]) offspringMap.set(o.id, o);

  // Z-262: przychód ze sprzedaży potomstwa per para (2 zapytania, bez N+1).
  // Potomstwo pary = zwierzęta z sireId=maleId AND damId=femaleId (w zakresie właściciela).
  const ownerScope = [
    { ownerId: user.id },
    ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
  ];
  const keyedPairs = pairs.filter((p) => p.maleId && p.femaleId);
  const revByKey = new Map<string, { revenue: number; soldCount: number }>();
  if (keyedPairs.length > 0) {
    const offspring = await prisma.pet.findMany({
      where: {
        AND: [
          { OR: keyedPairs.map((p) => ({ sireId: p.maleId, damId: p.femaleId })) },
          { OR: ownerScope },
        ],
      },
      select: { id: true, sireId: true, damId: true },
    });
    const offSales = offspring.length
      ? await prisma.petSale.findMany({ where: { petId: { in: offspring.map((o) => o.id) } }, select: { petId: true, price: true } })
      : [];
    const revByPet = new Map<string, { revenue: number; soldCount: number }>();
    for (const s of offSales) {
      const cur = revByPet.get(s.petId) ?? { revenue: 0, soldCount: 0 };
      cur.revenue += s.price ?? 0;
      cur.soldCount += 1;
      revByPet.set(s.petId, cur);
    }
    for (const o of offspring) {
      const key = `${o.sireId}|${o.damId}`;
      const acc = revByKey.get(key) ?? { revenue: 0, soldCount: 0 };
      const pet = revByPet.get(o.id);
      if (pet) { acc.revenue += pet.revenue; acc.soldCount += pet.soldCount; }
      revByKey.set(key, acc);
    }
  }
  const pairsEnriched = pairs.map((p) => {
    const stat = p.maleId && p.femaleId ? revByKey.get(`${p.maleId}|${p.femaleId}`) : undefined;
    return { ...p, revenue: stat?.revenue ?? 0, soldCount: stat?.soldCount ?? 0 };
  });

  return {
    genetics: pet.genetics,
    sire: pet.sire,
    dam: pet.dam,
    offspring: Array.from(offspringMap.values()),
    pairs: pairsEnriched as PetBreedingData["pairs"],
    sales: sales as PetSale[],
    candidates: candidatesRaw,
  };
}

export async function setParentage(petId: string, sireId: string | null, damId: string | null): Promise<void> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);
  if (sireId === petId || damId === petId) throw new Error("Zwierzę nie może być własnym rodzicem");
  await prisma.pet.update({ where: { id: petId }, data: { sireId, damId } });
  void trackActivity("pets", "set_parentage", { petId });
  revalidatePet(petId);
}

export async function setGenetics(petId: string, genes: PetGene[]): Promise<void> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);
  const clean = genes.filter((g) => g.gene.trim()).map((g) => ({ gene: g.gene.trim(), mode: g.mode, zygosity: g.zygosity }));
  await prisma.pet.update({ where: { id: petId }, data: { genetics: clean.length ? JSON.stringify(clean) : null } });
  void trackActivity("pets", "set_genetics", { petId, count: clean.length });
  revalidatePet(petId);
}

// ─── Pary hodowlane ─────────────────────────────────────────────────────────

export async function createBreedingPair(data: {
  name: string; species?: string; maleId?: string | null; femaleId?: string | null;
  status?: string; notes?: string | null; ownerTeamId?: string | null;
}): Promise<PetBreedingPair> {
  const user = await requireAuth();
  if (data.ownerTeamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "pets");
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego zespołu");
  }
  if (data.maleId) await assertPetAccess(data.maleId, user.id);
  if (data.femaleId) await assertPetAccess(data.femaleId, user.id);

  const pair = await prisma.petBreedingPair.create({
    data: {
      name: data.name.trim(),
      species: data.species ?? "other",
      maleId: data.maleId ?? null,
      femaleId: data.femaleId ?? null,
      status: data.status ?? "PLANNED",
      notes: data.notes ?? null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
    },
  });
  void trackActivity("pets", "create_breeding_pair", { name: pair.name });
  revalidatePath("/pets");
  return pair as PetBreedingPair;
}

export async function updateBreedingPair(id: string, patch: Partial<{
  name: string; status: string; notes: string | null; maleId: string | null; femaleId: string | null; startedAt: Date | null;
}>): Promise<PetBreedingPair> {
  const user = await requireAuth();
  await assertPairAccess(id, user.id);
  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();
  const pair = await prisma.petBreedingPair.update({ where: { id }, data });
  revalidatePath("/pets");
  return pair as PetBreedingPair;
}

export async function deleteBreedingPair(id: string): Promise<void> {
  const user = await requireAuth();
  await assertPairAccess(id, user.id);
  await prisma.petBreedingPair.delete({ where: { id } });
  revalidatePath("/pets");
}

// ─── Klutche / mioty ─────────────────────────────────────────────────────────

export async function createClutch(pairId: string, data: {
  laidAt?: Date | null; eggCount?: number | null; fertileCount?: number | null;
  incubationTempC?: number | null; humidityPct?: number | null; expectedHatchAt?: Date | null; notes?: string | null;
}): Promise<PetClutch> {
  const user = await requireAuth();
  await assertPairAccess(pairId, user.id);
  const clutch = await prisma.petClutch.create({
    data: {
      pairId,
      laidAt: data.laidAt ?? null,
      eggCount: data.eggCount ?? null,
      fertileCount: data.fertileCount ?? null,
      incubationTempC: data.incubationTempC ?? null,
      humidityPct: data.humidityPct ?? null,
      expectedHatchAt: data.expectedHatchAt ?? null,
      notes: data.notes ?? null,
    },
  });
  void trackActivity("pets", "create_clutch", { pairId });
  revalidatePath("/pets");
  return clutch as PetClutch;
}

export async function markClutchHatched(id: string, hatchedCount: number, hatchedAt?: Date): Promise<PetClutch> {
  const user = await requireAuth();
  const clutch = await prisma.petClutch.findUnique({ where: { id }, select: { pairId: true } });
  if (!clutch) throw new Error("Nie znaleziono klutchu");
  await assertPairAccess(clutch.pairId, user.id);
  const updated = await prisma.petClutch.update({
    where: { id },
    data: { status: "HATCHED", hatchedCount, hatchedAt: hatchedAt ?? new Date() },
  });
  revalidatePath("/pets");
  return updated as PetClutch;
}

export async function deleteClutch(id: string): Promise<void> {
  const user = await requireAuth();
  const clutch = await prisma.petClutch.findUnique({ where: { id }, select: { pairId: true } });
  if (!clutch) return;
  await assertPairAccess(clutch.pairId, user.id);
  await prisma.petClutch.delete({ where: { id } });
  revalidatePath("/pets");
}

// ─── Potomstwo ────────────────────────────────────────────────────────────

export async function createOffspring(data: {
  name: string; species: string; sex?: string | null; sireId?: string | null; damId?: string | null;
  presetKey?: string; ownerTeamId?: string | null;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  if (data.ownerTeamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "pets");
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego zespołu");
  }
  if (data.sireId) await assertPetAccess(data.sireId, user.id);
  if (data.damId) await assertPetAccess(data.damId, user.id);

  const pet = await prisma.pet.create({
    data: {
      name: data.name.trim(),
      species: data.species,
      sex: data.sex ?? null,
      sireId: data.sireId ?? null,
      damId: data.damId ?? null,
      presetKey: data.presetKey ?? "reptile_breeder",
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
    },
  });
  void trackActivity("pets", "create_offspring", { name: pet.name });
  revalidatePath("/pets");
  return { id: pet.id };
}

// ─── Sprzedaż ────────────────────────────────────────────────────────────

export async function recordSale(petId: string, data: {
  buyerName?: string | null; buyerContact?: string | null; price?: number | null;
  currency?: string; soldAt?: Date; notes?: string | null; markSold?: boolean;
}): Promise<PetSale> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);

  const sale = await prisma.petSale.create({
    data: {
      petId,
      buyerName: data.buyerName ?? null,
      buyerContact: data.buyerContact ?? null,
      price: data.price ?? null,
      currency: data.currency ?? "PLN",
      soldAt: data.soldAt ?? new Date(),
      notes: data.notes ?? null,
      ownerId: user.id,
    },
  });

  if (data.markSold !== false) {
    await prisma.pet.update({ where: { id: petId }, data: { status: "SOLD" as PetStatus } });
  }
  void trackActivity("pets", "record_sale", { petId, price: sale.price });
  revalidatePet(petId);
  return sale as PetSale;
}

export async function deleteSale(id: string): Promise<void> {
  const user = await requireAuth();
  const sale = await prisma.petSale.findUnique({ where: { id }, select: { petId: true, ownerId: true } });
  if (!sale) return;
  await assertPetAccess(sale.petId, user.id, true);
  await prisma.petSale.delete({ where: { id } });
  revalidatePet(sale.petId);
}
