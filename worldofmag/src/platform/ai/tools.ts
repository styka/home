import type { AiCatalog } from "./contribution";

/**
 * 049 — SZKIELET NARZĘDZI ODCZYTU.
 *
 * Zostało tu wyłącznie to, co nie wie nic o modułach: nagłówek katalogu i zawężanie go do
 * modułów wybranych przez router. Implementacje 56 narzędzi wróciły do swoich modułów, a katalog
 * składa się z deklaracji (rozdz. 9.6) — wcześniej wszystko siedziało w jednym pliku, który
 * importował kontrakty szesnastu modułów.
 */

export const READ_TOOLS_HEADER = "Dostępne narzędzia ODCZYTU (step \"query\"). Wywołaj je, gdy potrzebujesz danych użytkownika, zanim odpowiesz lub zaproponujesz akcje. Każdy wiersz zawiera \"id\" — użyj go w parametrach akcji (taskId/itemId/noteId/listId/projectId/petId), aby celować w konkretne rekordy.";

/**
 * Buduje katalog narzędzi ODCZYTU zawężony do wybranych modułów (+ narzędzia przekrojowe).
 * Zmniejsza rozmiar promptu systemowego agenta, żeby proste zapytanie odczytowe
 * (dwa wywołania modelu) mieściło się w minutowym limicie tokenów dostawcy.
 *
 * **Puste/nieznane `modules` → pełny katalog.** To bezpieczny fallback zachowany z 036: lepiej
 * zapłacić tokenami niż odciąć agentowi narzędzie, którego potrzebuje.
 */
export function buildReadToolsPrompt(modules: string[], catalog: AiCatalog): string {
  const known = new Set(Object.values(catalog.readToolModule));
  const selected = modules.filter((m) => known.has(m));
  const lines = catalog.readToolsPrompt.split("\n");
  if (selected.length === 0) return [READ_TOOLS_HEADER, ...lines].join("\n");

  const kept = lines.filter((line) => {
    const m = /^- (\w+):/.exec(line);
    if (!m) return true; // linie puste / nie-wypunktowane — zachowaj
    const mod = catalog.readToolModule[m[1]];
    // Narzędzie przekrojowe (wkład spoza modułu) i narzędzie nieprzypisane zostają — bezpiecznie.
    if (!mod || mod === "__core__") return true;
    return selected.includes(mod);
  });
  return [READ_TOOLS_HEADER, ...kept].join("\n");
}
