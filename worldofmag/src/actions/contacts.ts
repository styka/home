"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUserScope, ownedByWhere, assertOwnership } from "@/lib/ownership";

export type ContactDTO = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  ownerTeamId: string | null;
  createdAt: string;
};

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function toDTO(c: {
  id: string; name: string; phone: string | null; email: string | null;
  company: string | null; tags: string | null; notes: string | null;
  ownerTeamId: string | null; createdAt: Date;
}): ContactDTO {
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email, company: c.company,
    tags: parseTags(c.tags), notes: c.notes, ownerTeamId: c.ownerTeamId,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Lista kontaktów użytkownika (prywatne + zespołowe), z opcjonalnym wyszukiwaniem. */
export async function getContacts(search?: string): Promise<ContactDTO[]> {
  const { userId, teamIds } = await getUserScope();
  const q = search?.trim();
  const rows = await prisma.contact.findMany({
    where: {
      ...ownedByWhere(userId, teamIds),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              { tags: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  return rows.map(toDTO);
}

export async function createContact(data: {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
  ownerTeamId?: string | null;
}): Promise<void> {
  const { userId, teamIds } = await getUserScope();
  const name = data.name.trim();
  if (!name) throw new Error("Imię/nazwa kontaktu jest wymagane");
  if (data.ownerTeamId && !teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
  const tags = (data.tags ?? []).map((t) => t.trim()).filter(Boolean);
  await prisma.contact.create({
    data: {
      name,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      company: data.company?.trim() || null,
      tags: tags.length ? JSON.stringify(tags) : null,
      notes: data.notes?.trim() || null,
      ownerId: data.ownerTeamId ? null : userId,
      ownerTeamId: data.ownerTeamId || null,
    },
  });
  revalidatePath("/contacts");
}

export async function updateContact(
  id: string,
  patch: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
    tags?: string[];
    notes?: string | null;
  }
): Promise<void> {
  const { userId, teamIds } = await getUserScope();
  const existing = await prisma.contact.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  assertOwnership(existing, userId, teamIds);

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw new Error("Imię/nazwa kontaktu jest wymagane");
    data.name = n;
  }
  if (patch.phone !== undefined) data.phone = patch.phone?.trim() || null;
  if (patch.email !== undefined) data.email = patch.email?.trim() || null;
  if (patch.company !== undefined) data.company = patch.company?.trim() || null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.tags !== undefined) {
    const tags = patch.tags.map((t) => t.trim()).filter(Boolean);
    data.tags = tags.length ? JSON.stringify(tags) : null;
  }
  await prisma.contact.update({ where: { id }, data });
  revalidatePath("/contacts");
}

export async function deleteContact(id: string): Promise<void> {
  const { userId, teamIds } = await getUserScope();
  const existing = await prisma.contact.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  assertOwnership(existing, userId, teamIds);
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
}
