// 041: rozstrzyganie trybu sekcji AI — część SERWEROWA (czyta bazę).
//
// Osobny plik od `sectionMode.ts` wyłącznie z powodu granicy klient/serwer: etykiety trybów są
// potrzebne w komponencie klienckim (`AiContentMeta`), a ten nie może zaciągnąć `@/lib/prisma` —
// Prisma nie działa w przeglądarce i wywaliłaby build. Słownik pojęć został więc czysty, a wszystko,
// co dotyka bazy, mieszka tutaj (ten sam podział co `lib/llm/effort.ts` kontra `lib/llm/resolver.ts`).

import { prisma } from "@/platform/db/prisma";
import type { AiContentKind } from "@/platform/ai/contentMemory";
import {
  AI_SECTION_KINDS,
  AI_SECTION_MODES_CONFIG_KEY,
  DEFAULT_SECTION_MODE,
  isSectionMode,
  type AiSectionMode,
} from "@/platform/ai/sectionMode";

/**
 * Domyślne systemowe z `Config` — **bez sesji**, bo woła to również handler zadania w kolejce
 * (wzorzec `readCostBadgeEnabled` z 037).
 *
 * Każda awaria (brak wiersza, uszkodzony JSON, nieznana nazwa trybu) kończy się pustą mapą, czyli
 * trybem „na żądanie" dla wszystkich sekcji. Wysypanie strony przez jeden zepsuty wpis w
 * konfiguracji byłoby nieproporcjonalne do szkody.
 */
export async function readDefaultSectionModes(): Promise<Partial<Record<AiContentKind, AiSectionMode>>> {
  try {
    const row = await prisma.config.findUnique({ where: { key: AI_SECTION_MODES_CONFIG_KEY } });
    if (!row) return {};
    const parsed = JSON.parse(row.value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const out: Partial<Record<AiContentKind, AiSectionMode>> = {};
    for (const kind of AI_SECTION_KINDS) {
      const v = (parsed as Record<string, unknown>)[kind];
      if (isSectionMode(v)) out[kind] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Tryb JEDNEJ sekcji dla danego użytkownika: preferencja → `Config` → „na żądanie".
 *
 * Preferencja użytkownika i domyślne systemowe to dwa ROZŁĄCZNE zapisy (`AiSectionPref` kontra
 * `Config`), więc zmiana jednego nigdy nie nadpisuje drugiego — a użytkownik, który raz wybrał
 * swoje, przestaje dziedziczyć po administratorze.
 */
export async function resolveSectionMode(
  ownerId: string,
  kind: AiContentKind
): Promise<AiSectionMode> {
  const pref = await prisma.aiSectionPref.findUnique({
    where: { ownerId_sectionKind: { ownerId, sectionKind: kind } },
  });
  if (pref && isSectionMode(pref.mode)) return pref.mode;

  const defaults = await readDefaultSectionModes();
  return defaults[kind] ?? DEFAULT_SECTION_MODE;
}

/** Tryby WSZYSTKICH sekcji naraz — jedno zapytanie zamiast pięciu (ustawienia, strona modułu). */
export async function resolveSectionModes(
  ownerId: string
): Promise<Record<AiContentKind, AiSectionMode>> {
  const [prefs, defaults] = await Promise.all([
    prisma.aiSectionPref.findMany({ where: { ownerId } }),
    readDefaultSectionModes(),
  ]);
  const byKind = new Map(prefs.map((p) => [p.sectionKind, p.mode]));

  const out = {} as Record<AiContentKind, AiSectionMode>;
  for (const kind of AI_SECTION_KINDS) {
    const own = byKind.get(kind);
    out[kind] = isSectionMode(own) ? own : defaults[kind] ?? DEFAULT_SECTION_MODE;
  }
  return out;
}
