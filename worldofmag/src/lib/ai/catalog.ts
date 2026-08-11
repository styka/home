import { buildAiCatalog, type LoadedContribution } from "@/platform/ai/catalog";
import type { AiCatalog } from "@/platform/ai/contribution";
import { MODULES } from "@/lib/modules";
import coreContribution from "@/lib/ai/coreReadTools";

/**
 * 049 — KORZEŃ KOMPOZYCJI KATALOGU ASYSTENTA.
 *
 * Platforma dostarcza czystą funkcję składającą (`buildAiCatalog`), ale nie wolno jej znać modułów
 * (C-36). Składanie robi się więc tutaj, obok `src/lib/modules.tsx` — w jedynym miejscu, które
 * z definicji zna wszystkich.
 *
 * **Ładowanie jest asynchroniczne i zapamiętane.** Pole `ai` w deklaracji jest leniwe, bo ciągnie
 * kod serwerowy (Server Actions, Prisma), a `MODULES` importuje komponent kliencki powłoki.
 * Katalog budujemy więc raz, przy pierwszym żądaniu, i trzymamy — nie na każdą wiadomość
 * asystenta.
 */

let cached: Promise<AiCatalog> | null = null;

async function load(): Promise<AiCatalog> {
  const loaded: LoadedContribution[] = [];

  // Wkład przekrojowy (kalendarz, kosz) — narzędzia, które nie należą do żadnego modułu i mają być
  // dostępne zawsze, niezależnie od tego, do których modułów agent zawęził zapytanie.
  loaded.push({ id: "__core__", contribution: coreContribution });

  for (const m of MODULES) {
    if (!m.ai) continue;
    const mod = await m.ai();
    loaded.push({ id: m.id, contribution: mod.default });
  }

  return buildAiCatalog(loaded);
}

export function getAiCatalog(): Promise<AiCatalog> {
  if (!cached) cached = load();
  return cached;
}

/** Narzędzia zawsze dostępne — nie podlegają zawężaniu promptu do wybranych modułów. */
export const CORE_READ_TOOL_MODULE = "__core__";
