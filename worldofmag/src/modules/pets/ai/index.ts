import { actionCatalog } from "./catalog";
import { PET_ACTION_EXAMPLES } from "./petActions";
import type { AiContribution } from "@/platform/ai/contribution";
import { readTools, readToolsPrompt } from "./readTools";
import { executePetAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez pole `ai` w deklaracji — ten plik
 * ciągnie za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  actionCatalog,
  promptExamples: PET_ACTION_EXAMPLES,
  execute: executePetAction,
  readToolsPrompt,
  readTools,
};

export default contribution;
