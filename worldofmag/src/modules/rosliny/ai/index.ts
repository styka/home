import type { AiContribution } from "@/platform/ai/contribution";
import { actionCatalog } from "./catalog";
import { readTools, readToolsPrompt } from "./readTools";
import { executeRoslinyAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez `module.server.ts` — ten plik ciągnie
 * za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  actionCatalog,
  execute: executeRoslinyAction,
  readToolsPrompt,
  readTools,
};

export default contribution;
