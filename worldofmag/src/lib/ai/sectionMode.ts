// 041: TRYB ODŚWIEŻANIA sekcji AI — jedno miejsce, w którym mieszka odpowiedź na pytanie
// „kiedy ta sekcja ma zawołać model".
//
// Do 040 odpowiedź brzmiała „zawsze, gdy nie ma zapisu" i była zaszyta w `rememberedContent`.
// Skutek: pierwsze wejście na stronę kosztowało, a użytkownik nie miał nad tym żadnej kontroli.
// Teraz decyduje tryb: preferencja użytkownika → domyślne systemowe (`Config`) → „na żądanie".
//
// Kolejność rozstrzygania jest w JEDNEJ funkcji celowo. Rozsypana po komponentach dawałaby sekcje,
// które „prawie" tak samo dziedziczą po administratorze — a różnice wychodziłyby dopiero u
// użytkownika.

import { prisma } from "@/lib/prisma";
import type { AiContentKind } from "@/lib/ai/contentMemory";

/** String + union TS (C-12) — nigdy enum Prisma. */
export type AiSectionMode = "onDemand" | "onChange" | "always";

/** Klucz w tabeli `Config` z domyślnymi systemowymi (JSON: rodzaj sekcji → tryb). */
export const AI_SECTION_MODES_CONFIG_KEY = "ai_section_default_modes";

/**
 * Tryb bezpieczny: nic nie powstaje bez kliknięcia. To ma być wartość, do której degradujemy w
 * każdej niepewnej sytuacji (brak wiersza, uszkodzony JSON, nieznana nazwa trybu) — bo błąd w tę
 * stronę kosztuje użytkownika jedno kliknięcie, a w drugą: pieniądze za treść, o którą nie prosił.
 */
export const DEFAULT_SECTION_MODE: AiSectionMode = "onDemand";

/** Sekcje AI objęte trybem. Kolejność jest kolejnością wyświetlania w ustawieniach. */
export const AI_SECTION_KINDS: AiContentKind[] = [
  "weather.ideas",
  "news.hotTopics",
  "storage.insights",
  "pets.insights",
  "kitchen.planWeek",
];

/** Nazwy sekcji po polsku (C-32) — do ustawień użytkownika i administratora. */
export const AI_SECTION_LABELS: Record<AiContentKind, string> = {
  "weather.ideas": "Pogoda — „Co robić?”",
  "news.hotTopics": "Wiadomości — gorące tematy",
  "storage.insights": "Magazynowanie — wnioski",
  "pets.insights": "Pety — wnioski",
  "kitchen.planWeek": "Kuchnia — plan tygodnia",
};

/** Etykiety trybów wraz z wyjaśnieniem, bo sama nazwa nie mówi, co się stanie z kosztem. */
export const AI_SECTION_MODE_LABELS: Record<AiSectionMode, { label: string; hint: string }> = {
  onDemand: {
    label: "Na żądanie",
    hint: "Nic nie powstaje samo. Treść pojawia się dopiero po kliknięciu.",
  },
  onChange: {
    label: "Przy zmianie danych",
    hint: "Odświeża się samo, gdy zmienią się warunki, z których treść powstała.",
  },
  always: {
    label: "Zawsze świeże",
    hint: "Model odpowiada przy każdym wejściu. Najdroższy tryb.",
  },
};

export function isSectionMode(v: unknown): v is AiSectionMode {
  return v === "onDemand" || v === "onChange" || v === "always";
}

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
