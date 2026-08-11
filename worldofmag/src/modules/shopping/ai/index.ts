import { actionCatalog } from "./catalog";
import type { AiContribution } from "@/platform/ai/contribution";
import { readTools, readToolsPrompt } from "./readTools";
import { executeShoppingAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez pole `ai` w deklaracji — ten plik
 * ciągnie za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  actionCatalog,
  // Zakupy potrzebują z kontekstu jednej rzeczy — która lista jest w tej chwili otwarta.
  // Adapter mówi to wprost, zamiast przepuszczać przez egzekutor cały worek kontekstu.
  execute: (action, userId, ctx) => executeShoppingAction(action, userId, ctx.activeListId),
  readToolsPrompt,
  readTools,
};

export default contribution;
