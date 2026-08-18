"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { getAccessContext } from "@/platform/sharing/cache";
import { czyJezyk, strefaLubDomyslna, JEZYKI, NAZWY_JEZYKOW } from "@/platform/i18n/jezyki";

/**
 * 089 (zadania 34/37, Faza 7) — USTAWIENIA JĘZYKOWE PRZESTRZENI.
 *
 * Język i strefa należą do przestrzeni (rozdz. 8.2), nie do konta — więc ustawia się je per
 * przestrzeń, a nie raz na użytkownika. Dla większości ludzi to jedna przestrzeń osobista i jedno
 * pole w `/settings`; dla zespołu to ustawienie zespołu, wspólne dla wszystkich, którzy w nim pracują.
 */
export type UstawieniaPrzestrzeniDTO = {
  workspaceId: string;
  nazwa: string;
  kind: string;
  locale: string;
  timezone: string;
  /** Czy TEN użytkownik może to zmieniać (właściciel/administrator przestrzeni). */
  mogeZmieniac: boolean;
};

export async function getWorkspaceLocaleSettings(): Promise<{
  przestrzenie: UstawieniaPrzestrzeniDTO[];
  jezyki: { kod: string; nazwa: string }[];
}> {
  const user = await requireAuth();
  const ctx = await getAccessContext(user.id);
  const rows = await prisma.workspace.findMany({
    where: { id: { in: ctx.workspaceIds } },
    select: { id: true, name: true, kind: true, locale: true, timezone: true },
    orderBy: { kind: "asc" },
    take: 50,
  });
  return {
    przestrzenie: rows.map((w) => ({
      workspaceId: w.id,
      nazwa: w.name,
      kind: w.kind,
      locale: w.locale,
      timezone: w.timezone,
      // Przestrzeń osobista jest zawsze moja; w zespołowej decyduje rola z lustra członkostw.
      mogeZmieniac: w.kind === "personal" || ctx.adminTeamIds.length > 0,
    })),
    jezyki: JEZYKI.map((k) => ({ kod: k, nazwa: NAZWY_JEZYKOW[k] })),
  };
}

export async function setWorkspaceLocale(workspaceId: string, locale: string, timezone: string): Promise<void> {
  const user = await requireAuth();
  const ctx = await getAccessContext(user.id);
  // Guard po PRZESTRZENIACH, nie po `ownerId`: to jest jedyny nośnik własności od migracji 0244.
  if (!ctx.workspaceIds.includes(workspaceId)) throw new Error("Brak dostępu do tej przestrzeni");

  const przestrzen = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { kind: true } });
  if (!przestrzen) throw new Error("Przestrzeń nie istnieje");
  if (przestrzen.kind !== "personal" && ctx.adminTeamIds.length === 0) {
    throw new Error("Ustawienia zespołu może zmieniać wyłącznie jego właściciel lub administrator");
  }

  // Wartości spoza listy odrzucamy tutaj, ale to NIE jest jedyna obrona: odczyt (`jezykLubDomyslny`,
  // `strefaLubDomyslna`) też je degraduje. Walidacja stojąca wyłącznie w akcji obowiązuje tylko
  // tych, którzy przez nią przechodzą — a wiersz w bazie da się zmienić migracją albo z `psql`.
  if (!czyJezyk(locale)) throw new Error(`Nieobsługiwany język: ${locale}`);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { locale, timezone: strefaLubDomyslna(timezone) },
  });
  revalidatePath("/settings");
}
