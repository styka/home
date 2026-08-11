import { actionCatalog } from "./catalog";
import type { AiContribution } from "@/platform/ai/contribution";
import { readTools, readToolsPrompt } from "./readTools";
import { executeNewsAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez pole `ai` w deklaracji — ten plik
 * ciągnie za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  actionCatalog,
  execute: executeNewsAction,
  readToolsPrompt,
  readTools,
};

export default contribution;
