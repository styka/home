import type { AiContribution } from "@/platform/ai/contribution";
import { executeTasksAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez pole `ai` w deklaracji — ten plik
 * ciągnie za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  // Zadania potrzebują z kontekstu jednej rzeczy — który projekt jest w tej chwili oglądany.
  // Adapter mówi to wprost, zamiast przepuszczać przez egzekutor cały worek kontekstu.
  execute: (action, userId, ctx) => executeTasksAction(action, userId, ctx.currentProjectId),
};

export default contribution;
