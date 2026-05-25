"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import { DEFAULT_PRESET_KEY } from "@/lib/petPresets";
import type { Pet, PetWithRelations, PetShare, PetStatus, ShareRole } from "@/types";

const SHARE_INCLUDE = {
  user: { select: { id: true, name: true, email: true, image: true } },
  team: { select: { id: true, name: true } },
} as const;

/**
 * Rzuca, jeśli użytkownik nie ma dostępu do zwierzęcia.
 * `needEdit` wymaga roli właściciela/edytora (share VIEWER nie wystarcza).
 */
export async function assertPetAccess(petId: string, userId: string, needEdit = false): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: {
      ownerId: true,
      ownerTeamId: true,
      shares: { select: { userId: true, teamId: true, role: true } },
    },
  });
  if (!pet) throw new Error("Zwierzę nie istnieje");
  if (pet.ownerId === userId) return;
  if (pet.ownerTeamId && teamIds.includes(pet.ownerTeamId)) return;

  const share = pet.shares.find(
    (s) => s.userId === userId || (s.teamId && teamIds.includes(s.teamId)),
  );
  if (share) {
    if (!needEdit || share.role === "EDITOR") return;
    throw new Error("Masz dostęp tylko do odczytu");
  }
  throw new Error("Brak dostępu do zwierzęcia");
}

export async function getPets(opts?: { includeInactive?: boolean }): Promise<Pet[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const accessOr = [
    { ownerId: user.id },
    ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    { shares: { some: { userId: user.id } } },
    ...(teamIds.length > 0 ? [{ shares: { some: { teamId: { in: teamIds } } } }] : []),
  ];

  const pets = await prisma.pet.findMany({
    where: {
      OR: accessOr,
      ...(opts?.includeInactive ? {} : { status: { in: ["ACTIVE", "REHOMED", "SOLD"] } }),
    },
    include: {
      ownerTeam: { select: { id: true, name: true } },
      _count: { select: { treatments: true, careTasks: true, vetVisits: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return pets as Pet[];
}

export async function getPet(id: string): Promise<PetWithRelations | null> {
  const user = await requireAuth();
  await assertPetAccess(id, user.id);

  const pet = await prisma.pet.findUnique({
    where: { id },
    include: {
      ownerTeam: { select: { id: true, name: true } },
      shares: { include: SHARE_INCLUDE },
      measurements: { orderBy: { date: "desc" } },
      healthRecords: { orderBy: { date: "desc" } },
      vetVisits: { orderBy: { date: "desc" } },
      treatments: { orderBy: [{ active: "desc" }, { nextDueAt: "asc" }] },
      careTasks: { orderBy: [{ active: "desc" }, { nextDueAt: "asc" }] },
      careLogs: { orderBy: { occurredAt: "desc" }, take: 50 },
    },
  });

  return pet as PetWithRelations | null;
}

export async function createPet(data: {
  name: string;
  species?: string;
  breed?: string | null;
  sex?: string | null;
  birthDate?: Date | null;
  birthApprox?: boolean;
  acquiredAt?: Date | null;
  acquiredFrom?: string | null;
  microchipId?: string | null;
  identifier?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  presetKey?: string;
  featureFlags?: string | null;
  ownerTeamId?: string | null;
}): Promise<Pet> {
  const user = await requireAuth();

  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego zespołu");
  }

  const pet = await prisma.pet.create({
    data: {
      name: data.name.trim(),
      species: data.species ?? "other",
      breed: data.breed ?? null,
      sex: data.sex ?? null,
      birthDate: data.birthDate ?? null,
      birthApprox: data.birthApprox ?? false,
      acquiredAt: data.acquiredAt ?? null,
      acquiredFrom: data.acquiredFrom ?? null,
      microchipId: data.microchipId ?? null,
      identifier: data.identifier ?? null,
      color: data.color ?? null,
      photoUrl: data.photoUrl ?? null,
      notes: data.notes ?? null,
      presetKey: data.presetKey ?? DEFAULT_PRESET_KEY,
      featureFlags: data.featureFlags ?? null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
    },
    include: { ownerTeam: { select: { id: true, name: true } } },
  });

  void trackActivity("pets", "create_pet", { name: pet.name, species: pet.species });
  revalidatePath("/pets");
  return pet as Pet;
}

export async function updatePet(
  id: string,
  patch: Partial<{
    name: string;
    species: string;
    breed: string | null;
    sex: string | null;
    birthDate: Date | null;
    birthApprox: boolean;
    acquiredAt: Date | null;
    acquiredFrom: string | null;
    microchipId: string | null;
    identifier: string | null;
    color: string | null;
    photoUrl: string | null;
    notes: string | null;
    status: PetStatus;
    deceasedAt: Date | null;
  }>,
): Promise<Pet> {
  const user = await requireAuth();
  await assertPetAccess(id, user.id, true);

  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.name = patch.name.trim();

  const pet = await prisma.pet.update({
    where: { id },
    data,
    include: { ownerTeam: { select: { id: true, name: true } } },
  });

  void trackActivity("pets", "update_pet", { id, patchKeys: Object.keys(patch) });
  revalidatePath("/pets");
  revalidatePath(`/pets/${id}`);
  return pet as Pet;
}

export async function updatePetFeatures(
  id: string,
  presetKey: string,
  featureFlags: string | null,
): Promise<Pet> {
  const user = await requireAuth();
  await assertPetAccess(id, user.id, true);

  const pet = await prisma.pet.update({
    where: { id },
    data: { presetKey, featureFlags },
    include: { ownerTeam: { select: { id: true, name: true } } },
  });

  revalidatePath("/pets");
  revalidatePath(`/pets/${id}`);
  return pet as Pet;
}

export async function setPetStatus(id: string, status: PetStatus, deceasedAt?: Date | null): Promise<Pet> {
  return updatePet(id, {
    status,
    deceasedAt: status === "DECEASED" ? (deceasedAt ?? new Date()) : null,
  });
}

export async function deletePet(id: string): Promise<void> {
  const user = await requireAuth();
  await assertPetAccess(id, user.id, true);
  await prisma.pet.delete({ where: { id } });
  void trackActivity("pets", "delete_pet", { id });
  revalidatePath("/pets");
}

// ─── Sharing ──────────────────────────────────────────────────────────────

export async function getPetSharing(petId: string): Promise<PetShare[]> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id);
  const shares = await prisma.petShare.findMany({
    where: { petId },
    include: SHARE_INCLUDE,
  });
  return shares as PetShare[];
}

export async function sharePetByEmail(
  petId: string,
  email: string,
  role: ShareRole = "VIEWER",
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    await assertPetAccess(petId, user.id, true);

    const targetUser = await prisma.user.findFirst({ where: { email: email.trim() } });
    if (!targetUser) return { error: "Nie znaleziono użytkownika o tym adresie e-mail" };
    if (targetUser.id === user.id) return { error: "Nie możesz udostępnić zwierzęcia samemu sobie" };

    const existing = await prisma.petShare.findUnique({
      where: { petId_userId: { petId, userId: targetUser.id } },
    });
    if (existing) {
      await prisma.petShare.update({ where: { id: existing.id }, data: { role } });
    } else {
      await prisma.petShare.create({ data: { petId, userId: targetUser.id, role } });
    }

    void trackActivity("pets", "share_pet", { petId, role });
    revalidatePath(`/pets/${petId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Błąd udostępniania" };
  }
}

export async function sharePetWithTeam(petId: string, teamId: string, role: ShareRole = "VIEWER"): Promise<void> {
  const user = await requireAuth();
  await assertPetAccess(petId, user.id, true);

  const existing = await prisma.petShare.findUnique({ where: { petId_teamId: { petId, teamId } } });
  if (existing) {
    await prisma.petShare.update({ where: { id: existing.id }, data: { role } });
  } else {
    await prisma.petShare.create({ data: { petId, teamId, role } });
  }
  revalidatePath(`/pets/${petId}`);
}

export async function removePetShare(shareId: string): Promise<void> {
  const user = await requireAuth();
  const share = await prisma.petShare.findUnique({ where: { id: shareId } });
  if (!share) return;
  await assertPetAccess(share.petId, user.id, true);
  await prisma.petShare.delete({ where: { id: shareId } });
  revalidatePath(`/pets/${share.petId}`);
}
