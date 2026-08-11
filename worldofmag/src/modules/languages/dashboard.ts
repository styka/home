import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getDecks } from "./contract";

/**
 * 050: wkład Nauki języków do migawki pulpitu. Treść przeniesiona z trasy **bez zmiany** — te same
 * wywołania kontraktu, to samo mapowanie i ten sam `try/catch` z wartościami zerowymi.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "languagesDue" | "languageDecks">> = async () => {
  try {
    const decks = await getDecks();
    return {
      languagesDue: decks.reduce((sum, d) => sum + (d.dueCount ?? 0), 0),
      languageDecks: decks
        .filter((d) => (d.dueCount ?? 0) > 0)
        .sort((a, b) => (b.dueCount ?? 0) - (a.dueCount ?? 0))
        .slice(0, 4)
        .map((d) => ({ id: d.id, name: d.name, targetLang: d.targetLang, dueCount: d.dueCount ?? 0 })),
    };
  } catch {
    return { languagesDue: 0, languageDecks: [] };
  }
};

export default wklad;
