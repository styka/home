"use server";

// 041: ustawienia trybu sekcji AI — użytkownika (`AiSectionPref`) i systemowe (`Config`).
//
// Dwie ścieżki zapisu są ROZŁĄCZNE z konstrukcji: użytkownik pisze do swojego wiersza, administrator
// do klucza konfiguracji. Dzięki temu „moje" nigdy nie nadpisuje „systemowego" ani odwrotnie — nie
// trzeba tego pilnować dodatkowym warunkiem, którego łatwo zapomnieć przy kolejnej sekcji.

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { requireAuth } from "@/platform/auth/serverUtils";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { logAudit } from "@/platform/audit/audit";
import {
  AI_SECTION_KINDS,
  AI_SECTION_MODES_CONFIG_KEY,
  DEFAULT_SECTION_MODE,
  isSectionMode,
  type AiSectionMode,
} from "@/lib/ai/sectionMode";
import { readDefaultSectionModes, resolveSectionModes } from "@/lib/ai/sectionModeResolver";
import type { AiContentKind } from "@/lib/ai/contentMemory";

export interface SectionModeDTO {
  kind: AiContentKind;
  /** Tryb obowiązujący (po rozstrzygnięciu kolejności). */
  mode: AiSectionMode;
  /** `true`, gdy wartość pochodzi z ustawień administratora, a nie z własnego wyboru. */
  inherited: boolean;
}

/** Tryby wszystkich sekcji dla zalogowanego — z informacją, co jest własne, a co odziedziczone. */
export async function getSectionModes(): Promise<SectionModeDTO[]> {
  const user = await requireAuth();
  const [resolved, own] = await Promise.all([
    resolveSectionModes(user.id),
    prisma.aiSectionPref.findMany({ where: { ownerId: user.id } }),
  ]);
  const ownKinds = new Set(own.filter((p) => isSectionMode(p.mode)).map((p) => p.sectionKind));

  return AI_SECTION_KINDS.map((kind) => ({
    kind,
    mode: resolved[kind],
    inherited: !ownKinds.has(kind),
  }));
}

/** Zapis własnego trybu sekcji. Od tej chwili użytkownik przestaje dziedziczyć po administratorze. */
export async function setSectionMode(kind: AiContentKind, mode: AiSectionMode): Promise<void> {
  const user = await requireAuth();
  if (!AI_SECTION_KINDS.includes(kind)) throw new Error("Nieznana sekcja AI");
  if (!isSectionMode(mode)) throw new Error("Nieznany tryb odświeżania");

  await prisma.aiSectionPref.upsert({
    where: { ownerId_sectionKind: { ownerId: user.id, sectionKind: kind } },
    create: { ownerId: user.id, sectionKind: kind, mode },
    update: { mode },
  });

  // Sekcje AI siedzą w różnych modułach, a tryb zmienia to, co strona pokazuje po wejściu — stąd
  // odświeżenie od korzenia, a nie jednej ścieżki.
  revalidatePath("/", "layout");
}

/** Powrót do wartości administratora — kasujemy wiersz, zamiast zapisywać „taką samą" wartość. */
export async function clearSectionMode(kind: AiContentKind): Promise<void> {
  const user = await requireAuth();
  await prisma.aiSectionPref.deleteMany({
    where: { ownerId: user.id, sectionKind: kind },
  });
  revalidatePath("/", "layout");
}

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
}

/** Systemowe domyślne (administrator) — sekcje bez wpisu pokazujemy jako „na żądanie". */
export async function getDefaultSectionModes(): Promise<Record<string, AiSectionMode>> {
  await requireAdmin();
  const stored = await readDefaultSectionModes();
  const out: Record<string, AiSectionMode> = {};
  for (const kind of AI_SECTION_KINDS) out[kind] = stored[kind] ?? DEFAULT_SECTION_MODE;
  return out;
}

/**
 * Zapis systemowych domyślnych. Dotyczy wyłącznie użytkowników BEZ własnej preferencji — czyjś
 * świadomy wybór zostaje nietknięty (AC-11).
 */
export async function setDefaultSectionModes(
  modes: Record<string, string>
): Promise<void> {
  await requireAdmin();

  // Zapisujemy wyłącznie znane sekcje i znane tryby — konfiguracja jest czytana bez sesji przez
  // handlery zadań, więc śmieć w tym kluczu byłby trudny do wytropienia.
  const clean: Record<string, AiSectionMode> = {};
  for (const kind of AI_SECTION_KINDS) {
    const v = modes[kind];
    clean[kind] = isSectionMode(v) ? v : DEFAULT_SECTION_MODE;
  }
  const value = JSON.stringify(clean);

  await prisma.config.upsert({
    where: { key: AI_SECTION_MODES_CONFIG_KEY },
    update: { value },
    create: { key: AI_SECTION_MODES_CONFIG_KEY, value },
  });

  await logAudit(
    "config",
    "ai_section_modes.set",
    AI_SECTION_MODES_CONFIG_KEY,
    `Zmieniono domyślne tryby odświeżania sekcji AI: ${AI_SECTION_KINDS.map((k) => `${k}=${clean[k]}`).join(", ")}`
  );
  revalidatePath("/admin/llm");
}
