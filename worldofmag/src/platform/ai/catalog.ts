import type { AiCatalog, AiContribution } from "./contribution";

/**
 * 049 — SKŁADANIE KATALOGU ASYSTENTA Z DEKLARACJI (rozdz. 9.6).
 *
 * Funkcja jest **czysta i nie zna żadnego modułu**: dostaje listę wkładów parametrem, tak jak
 * `filterAccessibleFavorites(…, isPathLocked)` dostaje wiedzę o ścieżkach. Identyfikatory modułów
 * przychodzą z zewnątrz razem z wkładami — platforma ich nie zna i nie ma skąd wziąć (C-36, AC-3).
 *
 * Bramki nie znikają, tylko pilnują czegoś mocniejszego: dotąd sprawdzały, czy **ręczna lista**
 * jest kompletna; teraz — czy każdy moduł zadeklarował swoje akcje i czy każda ma egzekutor.
 * Modułu nie da się zapomnieć, bo moduł bez deklaracji nie istnieje dla aplikacji.
 */

export type LoadedContribution = { id: string; contribution: AiContribution };

/**
 * Nazwy narzędzi ZAWSZE dostępnych, niezależnie od tego, do których modułów agent zawęził
 * zapytanie. Deklaruje je wkład przekrojowy (kalendarz, kosz) — nie jest to lista modułów,
 * tylko lista narzędzi, więc platforma może ją trzymać bez łamania asymetrii.
 */
export function buildAiCatalog(loaded: LoadedContribution[]): AiCatalog {
  const actionCatalogByModule: AiCatalog["actionCatalogByModule"] = {};
  const promptExamplesByModule: AiCatalog["promptExamplesByModule"] = {};
  const executeByModule: AiCatalog["executeByModule"] = {};
  const readTools: AiCatalog["readTools"] = {};
  const readToolModule: AiCatalog["readToolModule"] = {};
  const promptParts: string[] = [];

  for (const { id, contribution } of loaded) {
    if (contribution.actionCatalog) actionCatalogByModule[id] = contribution.actionCatalog;
    if (contribution.promptExamples) promptExamplesByModule[id] = contribution.promptExamples;
    if (contribution.execute) executeByModule[id] = contribution.execute;
    if (contribution.readToolsPrompt) promptParts.push(contribution.readToolsPrompt);
    for (const [name, handler] of Object.entries(contribution.readTools ?? {})) {
      if (readTools[name]) {
        // Dwa moduły deklarujące narzędzie o tej samej nazwie po cichu nadpisałyby się nawzajem,
        // a agent wołałby raz jedno, raz drugie zależnie od kolejności importów. To jest błąd.
        throw new Error(`Zduplikowane narzędzie odczytu „${name}" — deklarują je „${readToolModule[name]}" i „${id}".`);
      }
      readTools[name] = handler;
      readToolModule[name] = id;
    }
  }

  return {
    actionCatalogByModule,
    promptExamplesByModule,
    executeByModule,
    readToolsPrompt: promptParts.join("\n"),
    readTools,
    readToolModule,
  };
}
