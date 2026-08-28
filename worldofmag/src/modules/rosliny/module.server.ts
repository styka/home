import type { ModuleServerContributions } from "@/platform/registry.server";

/**
 * 113 — wkład SERWEROWY modułu, oddzielony od deklaracji `module.ts`.
 *
 * **Bez pola `jobs` i to jest decyzja, nie przeoczenie.** Moduł nie ma handlera w tle:
 * przypomnienia idą przez istniejący `syncReminders`, a treści AI powstają na żądanie przez
 * `rememberedContent`. Pusty rejestr zadań byłby plikiem bez konsumenta (C-35) i wciągałby graf
 * serwerowy bez powodu.
 */
const server: ModuleServerContributions = {
  ai: () => import("./ai"),
  calendar: () => import("./calendar"),
};

export default server;
