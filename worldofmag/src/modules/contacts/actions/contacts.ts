"use server";

import { prisma } from "@/platform/db/prisma";
import { updateWithVersion } from "@/platform/concurrency/version";
import { revalidatePath } from "next/cache";
import { getUserScope, ownedByWhere, assertOwnership } from "@/platform/auth/ownership";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";
import { recordTrash } from "@/platform/trash/trash";
import { parseBirthday } from "../domain/urodziny";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import { createTask, tasksModule } from "@/modules/tasks/contract";

export type ContactDTO = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  /** "YYYY-MM-DD" (dzień kalendarzowy) albo null. */
  birthday: string | null;
  tags: string[];
  notes: string | null;
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
  company: string | null; birthday: Date | null; tags: string | null; notes: string | null;
  createdAt: Date;
}): ContactDTO {
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email, company: c.company,
    // Dzień kalendarzowy bez strefy: urodziny zapisujemy jako północ UTC danego dnia,
    // więc `toISOString().slice(0,10)` oddaje dokładnie wpisany dzień.
    birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : null,
    tags: parseTags(c.tags), notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}


/** Lista kontaktów użytkownika (prywatne + zespołowe), z opcjonalnym wyszukiwaniem. */
export async function getContacts(search?: string): Promise<ContactDTO[]> {
  const { userId } = await getUserScope();
  const q = search?.trim();
  const rows = await prisma.contact.findMany({
    take: SUFIT_LISTY,
    where: {
      ...(await ownedByWhere(userId)),
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
  birthday?: string | null;
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
      birthday: parseBirthday(data.birthday),
      tags: tags.length ? JSON.stringify(tags) : null,
      notes: data.notes?.trim() || null,
      ...(await wlasnoscDoZapisu(userId, data.ownerTeamId)),
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
    birthday?: string | null;
    tags?: string[];
    notes?: string | null;
  },
  expectedVersion?: number
): Promise<void> {
  const { userId } = await getUserScope();
  const existing = await prisma.contact.findUnique({ where: { id }, select: { workspaceId: true } });
  await assertOwnership(existing, userId);

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw new Error("Imię/nazwa kontaktu jest wymagane");
    data.name = n;
  }
  if (patch.phone !== undefined) data.phone = patch.phone?.trim() || null;
  if (patch.email !== undefined) data.email = patch.email?.trim() || null;
  if (patch.company !== undefined) data.company = patch.company?.trim() || null;
  if (patch.birthday !== undefined) data.birthday = parseBirthday(patch.birthday);
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.tags !== undefined) {
    const tags = patch.tags.map((t) => t.trim()).filter(Boolean);
    data.tags = tags.length ? JSON.stringify(tags) : null;
  }
  // 092 (zadanie 15): zapis idzie przez mechanizm wersji. `expectedVersion` jest opcjonalne —
  // dopóki klient go nie przesyła, zapis jest bezwarunkowy, ale JUŻ przechodzi jednym miejscem, więc
  // włączenie kontroli konfliktu nie będzie wymagało ruszania tej akcji.
  await updateWithVersion(prisma.contact, "contacts.contact", id, data, expectedVersion);
  revalidatePath("/contacts");
}

export async function deleteContact(id: string): Promise<void> {
  const { userId } = await getUserScope();
  const existing = await prisma.contact.findUnique({ where: { id } });
  await assertOwnership(existing, userId);
  // Do kosza przed twardym usunięciem — kontakt to płaski rekord, więc migawka JSON wystarcza.
  // Dotąd „usuń" było bezpowrotne, choć platforma ma kosz i /trash obiecuje przywracanie.
  await recordTrash(userId, {
    module: "contacts",
    entityId: id,
    title: `Kontakt: ${existing!.name}`,
    payload: existing,
  });
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
  revalidatePath("/trash");
}

/**
 * 115 (Z-INT-08): follow-up z kontaktu — „Skontaktuj się: <nazwa>" w Zadaniach,
 * z telefonem/e-mailem w opisie i odnośnikiem do Kontaktów. Najtańsza namiastka
 * historii interakcji lekkiego CRM.
 */
export async function createTaskFromContact(id: string): Promise<{ id: string }> {
  const { userId } = await getUserScope();
  const session = await auth();
  if (!hasPermission(session, tasksModule.permission)) throw new Error("Brak dostępu do modułu Zadania");
  const contact = await prisma.contact.findUnique({ where: { id } });
  await assertOwnership(contact, userId);
  const c = contact!;
  const opis = [
    c.phone ? `Telefon: ${c.phone}` : null,
    c.email ? `E-mail: ${c.email}` : null,
    c.company ? `Firma: ${c.company}` : null,
    "Kontakt: /contacts",
  ].filter(Boolean).join("\n");
  const task = await createTask({ title: `Skontaktuj się: ${c.name}`, description: opis });
  revalidatePath("/tasks");
  return { id: task.id };
}
