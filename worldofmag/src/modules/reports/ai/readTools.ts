import { searchReports } from "../contract";
import { clampLimit, asStr } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- search_reports: args { query } → [{ slug, title, category }]. Wyszukuje raporty (markdown) po treści/tytule.",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  search_reports: async (args, userId) => {
      const q = asStr(args.query) ?? asStr(args.search) ?? "";
      const reports = await searchReports(q);
      return reports.slice(0, clampLimit(args.limit)).map((r) => ({ slug: r.slug, title: r.title, category: r.category }));
  },
};
