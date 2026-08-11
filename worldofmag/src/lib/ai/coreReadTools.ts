import { getTrash } from "@/actions/trash";
import { getCalendarEvents } from "@/actions/calendarAgenda";
import { clampLimit } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU **przekrojowe** — nie należą do żadnego modułu.
 *
 * Kalendarz agreguje sześć modułów, a kosz jest zdolnością platformy; oba mają być dostępne
 * dla agenta zawsze, niezależnie od tego, do których modułów zawęził zapytanie. Dlatego wkład
 * siedzi w warstwie kompozycji, a nie w module — po tej samej regule co `readToolShared.ts`.
 */
/**
 * `web_search` NIE ma tu implementacji — trasa agenta obsługuje je osobno (idzie do internetu,
 * nie do bazy). Wiersz katalogu musi jednak istnieć, inaczej model nie wie, że narzędzie jest
 * dostępne. Rozbicie na wkłady modułowe zgubiło ten wiersz i **złapał to test** `buildReadToolsPrompt`
 * — pierwszy dowód, że warto było mieć go wcześniej.
 */
export const readToolsPrompt = [
  "- web_search: args { query, limit? } → [{ title, url, snippet }]. Wyszukiwarka internetowa — użyj TYLKO gdy potrzebujesz informacji spoza danych użytkownika (ceny, fakty, definicje, świat zewnętrzny). W odpowiedzi cytuj źródła linkami markdown.",
  "- list_calendar: args { year?, month? } → [{ module, title, date, at, href }]. Zagregowany kalendarz (zadania + posiłki + zdrowie + przeglądy floty) dla danego miesiąca (domyślnie bieżący; month = 1-12).",
  "- list_trash: args {} → { retentionDays, items:[{ id, module, label, deletedAt, daysLeft }] }. Kosz — elementy usunięte (do przywrócenia w /trash).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_calendar: async (args, userId) => {
      // Reużywa agregatu kalendarza (zadania + posiłki + zdrowie + flota), scoping user/zespół wewnątrz.
      const now = new Date();
      const year = typeof args.year === "number" ? args.year : now.getFullYear();
      const month1 = typeof args.month === "number" ? Math.max(1, Math.min(12, args.month)) : now.getMonth() + 1;
      const events = await getCalendarEvents(year, month1 - 1);
      return events.map((e) => ({ module: e.module, title: e.title, date: e.date, at: e.at, href: e.href }));
  },
  list_trash: async (args, userId) => {
      const { items, retentionDays } = await getTrash();
      return {
        retentionDays,
        items: items.slice(0, clampLimit(args.limit)).map((it) => ({
          id: it.id, module: it.module, label: it.title, deletedAt: it.deletedAt,
        })),
      };
  },
};

import type { AiContribution } from "@/platform/ai/contribution";

const contribution: AiContribution = { readToolsPrompt, readTools };
export default contribution;
