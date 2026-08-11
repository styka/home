import type { AiContribution } from "./ai/contribution";
import type { CalendarContributor } from "./calendar";
import type { JobHandler } from "./jobs/types";

/**
 * 049 — WKŁAD SERWEROWY MODUŁU, po drugiej stronie granicy klient/serwer.
 *
 * `ModuleDeclaration` (`registry.ts`) opisuje moduł tak, jak widzi go **powłoka**: etykieta, ikona,
 * uprawnienie, trasy, nawigacja boczna. Ten typ opisuje to, czego moduł dostarcza **serwerowi**:
 * wkład do asystenta, zadania w tle i zdarzenia do wspólnej agendy.
 *
 * **Rozdzielenie nie jest kosmetyką — jest wymuszone i zmierzone.** Gdy te trzy pola siedziały
 * w `module.ts`, całość trafiała do grafu klienta przez `MODULES` → `ModuleSidebar`. Produkcyjny
 * bundel wyglądał identycznie (tree-shaking), ale **tryb deweloperski kompilował kod serwerowy przy
 * każdej stronie**: pełny zestaw klikaczy urósł z 12,7 do 26,0 minuty, smoke z 46 do 125 sekund,
 * i doszło sześć czerwonych z przekroczonych limitów czasu. `next build` tego nie pokazuje — trzeba
 * było zmierzyć.
 *
 * Zasada na przyszłość: **do `module.ts` trafia tylko to, co wolno wysłać do przeglądarki.**
 */
export type ModuleServerContributions = {
  /** Wkład do asystenta AI: katalog akcji, egzekutor, narzędzia odczytu. */
  ai?: () => Promise<{ default: AiContribution }>;
  /** Zadania w tle tego modułu; z nich powstaje allowlista kolejkowania. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs?: () => Promise<{ default: Record<string, JobHandler<any, any>> }>;
  /** Wkład do wspólnej agendy kalendarza. */
  calendar?: () => Promise<{ default: CalendarContributor }>;
};
