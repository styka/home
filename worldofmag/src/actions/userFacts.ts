"use server";

// 039: wiedza o użytkowniku — przekrojowa baza faktów, z której korzystają moduły generujące
// treść „pod niego" (dziś Pogoda).
//
// Zasada, która trzyma to w ryzach: fakty są JAWNE i odwracalne. Użytkownik widzi każdy z nich,
// wie skąd się wziął, może go poprawić, potwierdzić albo odrzucić — a odrzucony nie wraca. Bez
// tego byłby to niewidzialny profil, który po cichu steruje tym, co system mu proponuje.

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { requireAuth } from "@/platform/auth/serverUtils";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { fingerprintOf } from "@/lib/textKey";
import { wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";
import {
  parseUserFactCategory,
  parseUserFactConfidence,
  type UserFactCategory,
  type UserFactConfidence,
  type UserFactDTO,
  type UserFactOrigin,
  type UserFactStatus,
} from "@/lib/userFacts";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  return session!;
}

function toDTO(r: {
  id: string;
  category: string;
  text: string;
  confidence: string;
  origin: string;
  status: string;
  evidence: string | null;
  createdAt: Date;
}): UserFactDTO {
  return {
    id: r.id,
    category: parseUserFactCategory(r.category),
    text: r.text,
    confidence: parseUserFactConfidence(r.confidence),
    origin: r.origin as UserFactOrigin,
    status: r.status as UserFactStatus,
    evidence: r.evidence,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Aktywne fakty zalogowanego użytkownika (odrzucone zostają w bazie, ale nie na widoku). */
export async function getUserFacts(): Promise<UserFactDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.userFact.findMany({
    where: { ownerId: user.id, status: "active" },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

/**
 * Jedna hipoteza do pokazania na karcie — rzadko i pojedynczo.
 *
 * Świadomie zwracamy JEDEN fakt, a nie listę: karta hipotezy pojawia się przy okazji, w rogu
 * innego widoku. Pokazanie kilku naraz zamieniłoby ją w ankietę, czyli w dokładnie ten przerywnik,
 * którego ta funkcja ma nie tworzyć.
 */
export async function getPendingHypothesis(): Promise<UserFactDTO | null> {
  const user = await requireAuth();
  const row = await prisma.userFact.findFirst({
    where: { ownerId: user.id, status: "active", origin: "inferred", confidence: { not: "confirmed" } },
    orderBy: { createdAt: "desc" },
  });
  return row ? toDTO(row) : null;
}

async function assertOwnFact(id: string, userId: string) {
  const row = await prisma.userFact.findUnique({ where: { id } });
  if (!row || row.ownerId !== userId) throw new Error("Fakt nie istnieje");
  return row;
}

/** „Zgadza się" — fakt przestaje być hipotezą i nie wraca już jako pytanie. */
export async function confirmUserFact(id: string): Promise<void> {
  const user = await requireAuth();
  await assertOwnFact(id, user.id);
  await prisma.userFact.update({
    where: { id },
    data: { origin: "confirmed", confidence: "confirmed", status: "active" },
  });
  revalidatePath("/settings");
}

/**
 * „Nie o mnie" — fakt znika z użycia, ale ZOSTAJE w bazie ze statusem `rejected`.
 *
 * Kasowanie wiersza byłoby błędem: wnioskowanie wyciągnęłoby ten sam wniosek z tych samych
 * zachowań i zaproponowało go ponownie. Odrzucone trafiają do promptu jako „nie proponuj".
 */
export async function rejectUserFact(id: string): Promise<void> {
  const user = await requireAuth();
  await assertOwnFact(id, user.id);
  await prisma.userFact.update({ where: { id }, data: { status: "rejected" } });
  revalidatePath("/settings");
}

/** Ręczne dopisanie/poprawienie faktu przez użytkownika. */
export async function upsertUserFact(data: {
  id?: string;
  category: UserFactCategory;
  text: string;
  confidence?: UserFactConfidence;
}): Promise<void> {
  const user = await requireAuth();
  const text = data.text.trim();
  if (!text) throw new Error("Treść faktu jest wymagana");

  if (data.id) {
    await assertOwnFact(data.id, user.id);
    await prisma.userFact.update({
      where: { id: data.id },
      data: {
        category: parseUserFactCategory(data.category),
        text,
        // Fakt tknięty ręką użytkownika przestaje być domysłem systemu.
        confidence: parseUserFactConfidence(data.confidence ?? "confirmed"),
        origin: "confirmed",
        status: "active",
        fingerprint: fingerprintOf(text),
      },
    });
  } else {
    const fingerprint = fingerprintOf(text);
    await prisma.userFact.upsert({
      where: { ownerId_fingerprint: { ownerId: user.id, fingerprint } },
      create: {
        ...(await wlasnoscOsobistaDoZapisu(user.id)),
        category: parseUserFactCategory(data.category),
        text,
        confidence: parseUserFactConfidence(data.confidence ?? "confirmed"),
        origin: "confirmed",
        status: "active",
        fingerprint,
      },
      // Wpisanie ręcznie tego, co system wcześniej odrzucił/zgadł, jest jawnym potwierdzeniem.
      update: {
        category: parseUserFactCategory(data.category),
        text,
        confidence: parseUserFactConfidence(data.confidence ?? "confirmed"),
        origin: "confirmed",
        status: "active",
      },
    });
  }
  revalidatePath("/settings");
}

export async function deleteUserFact(id: string): Promise<void> {
  const user = await requireAuth();
  await assertOwnFact(id, user.id);
  await prisma.userFact.delete({ where: { id } });
  revalidatePath("/settings");
}

// ─── Administrator ──────────────────────────────────────────────────────────

export async function getUserFactsForAdmin(userId: string): Promise<UserFactDTO[]> {
  await requireAdmin();
  const rows = await prisma.userFact.findMany({
    where: { ownerId: userId },
    orderBy: [{ status: "asc" }, { category: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

/**
 * Fakt ustawiony przez administratora (`origin: "admin"`).
 *
 * Wnioskowanie takich faktów nie rusza — inaczej korekta administratora żyłaby do najbliższego
 * przebiegu w tle i cicho znikała.
 */
export async function setUserFactByAdmin(data: {
  userId: string;
  id?: string;
  category: UserFactCategory;
  text: string;
  confidence?: UserFactConfidence;
}): Promise<void> {
  await requireAdmin();
  const text = data.text.trim();
  if (!text) throw new Error("Treść faktu jest wymagana");
  const fingerprint = fingerprintOf(text);

  if (data.id) {
    const row = await prisma.userFact.findUnique({ where: { id: data.id } });
    if (!row || row.ownerId !== data.userId) throw new Error("Fakt nie istnieje");
    await prisma.userFact.update({
      where: { id: data.id },
      data: {
        category: parseUserFactCategory(data.category),
        text,
        confidence: parseUserFactConfidence(data.confidence ?? "likely"),
        origin: "admin",
        status: "active",
        fingerprint,
      },
    });
  } else {
    await prisma.userFact.upsert({
      where: { ownerId_fingerprint: { ownerId: data.userId, fingerprint } },
      create: {
        ...(await wlasnoscOsobistaDoZapisu(data.userId)),
        category: parseUserFactCategory(data.category),
        text,
        confidence: parseUserFactConfidence(data.confidence ?? "likely"),
        origin: "admin",
        status: "active",
        fingerprint,
      },
      update: {
        category: parseUserFactCategory(data.category),
        text,
        confidence: parseUserFactConfidence(data.confidence ?? "likely"),
        origin: "admin",
        status: "active",
      },
    });
  }
  revalidatePath("/admin");
}

export async function deleteUserFactByAdmin(id: string): Promise<void> {
  await requireAdmin();
  await prisma.userFact.delete({ where: { id } });
  revalidatePath("/admin");
}
