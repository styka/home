import { actionCatalog } from "./catalog";
import type { AiContribution } from "@/platform/ai/contribution";
import { readTools, readToolsPrompt } from "./readTools";
import { executeTasksAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez pole `ai` w deklaracji — ten plik
 * ciągnie za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  actionCatalog,
  // Zadania potrzebują z kontekstu jednej rzeczy — który projekt jest w tej chwili oglądany.
  // Adapter mówi to wprost, zamiast przepuszczać przez egzekutor cały worek kontekstu.
  execute: (action, userId, ctx) => executeTasksAction(action, userId, ctx.currentProjectId),
  readToolsPrompt,
  readTools,
};

export default contribution;
