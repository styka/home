import type { AIAction } from "./aiAction";

/**
 * 049 — WKŁAD MODUŁU DO ASYSTENTA.
 *
 * Do tej pory asystent miał trzy równoległe listy utrzymywane ręcznie obok rejestru modułów:
 * katalog akcji (bloki tekstu w prompcie), łańcuch `if (module === …)` w trasie egzekucji
 * i `switch (name)` po kilkudziesięciu narzędziach odczytu. Moduł mógł istnieć w aplikacji
 * i nie istnieć dla asystenta — albo odwrotnie, zostać w katalogu po usunięciu.
 *
 * Po tej zmianie katalog jest **składany z deklaracji** (rozdz. 9.6). Typy tutaj są celowo
 * **niewiedzące o żadnym module**: biorą `userId` parametrem, nie zaglądają do rejestru i nie
 * znają żadnego identyfikatora modułu (C-36). Platforma dostarcza kształt; kto go wypełnia,
 * rozstrzyga korzeń kompozycji.
 */

/** Wynik pojedynczej akcji zapisu: komunikat + opcjonalna propozycja przejścia i cofnięcia. */
export interface ExecOutcome {
  message: string;
  navigateTo?: string;
  navigateLabel?: string;
  undo?: AIAction;
}

/** Rezultat akcji widziany przez klienta (panel przeglądu). */
export interface ActionResult {
  id: string;
  success: boolean;
  description: string;
  error?: string;
  navigateTo?: string;
  navigateLabel?: string;
  undo?: AIAction;
}

/**
 * Kontekst, którego egzekutor może potrzebować poza `userId`.
 *
 * Pola są **opcjonalne i nazwane po tym, czym są dla użytkownika** (aktywna lista, oglądany
 * projekt), a nie po module — inaczej platforma zaczęłaby znać moduły tylnymi drzwiami.
 */
export interface AiExecContext {
  activeListId?: string;
  currentProjectId?: string;
}

/** Egzekutor akcji zapisu jednego modułu. */
export type AiActionExecutor = (
  action: AIAction,
  userId: string,
  ctx: AiExecContext,
) => Promise<string | ExecOutcome>;

/** Implementacja pojedynczego narzędzia odczytu. */
export type AiReadToolHandler = (
  args: Record<string, unknown>,
  userId: string,
) => Promise<unknown>;

/**
 * Wkład jednego modułu do asystenta.
 *
 * `actionCatalog` i `readToolsPrompt` to **tekst wstrzykiwany do promptu systemowego** — trzymany
 * przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „implementację" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a bramka `check:actions`
 * porównuje jedno z drugim i wywala build, gdy się rozjadą.
 */
export interface AiContribution {
  /** Blok katalogu akcji zapisu (tekst promptu) tego modułu. */
  actionCatalog?: string;
  /** Egzekutor akcji zapisu tego modułu. */
  execute?: AiActionExecutor;
  /**
   * Przykłady użycia dopisywane do sekcji przykładów w prompcie (nie do katalogu akcji).
   * Osobne pole, bo to inne miejsce w prompcie — sklejenie z katalogiem przeniosłoby przykłady
   * do sekcji, w której model spodziewa się definicji.
   */
  promptExamples?: string;
  /** Wiersze katalogu narzędzi odczytu (tekst promptu), po jednym na narzędzie. */
  readToolsPrompt?: string;
  /** Narzędzia odczytu: nazwa → implementacja. */
  readTools?: Record<string, AiReadToolHandler>;
}

/**
 * Złożony katalog asystenta.
 *
 * `executeByModule` jest mapą **identyfikator modułu → egzekutor**, ale platforma tych
 * identyfikatorów nie zna — dostaje je razem z deklaracjami od korzenia kompozycji.
 */
export interface AiCatalog {
  actionCatalogByModule: Record<string, string>;
  promptExamplesByModule: Record<string, string>;
  executeByModule: Record<string, AiActionExecutor>;
  readToolsPrompt: string;
  readTools: Record<string, AiReadToolHandler>;
  readToolModule: Record<string, string>;
}
