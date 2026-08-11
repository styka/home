import type { AiContribution } from "@/platform/ai/contribution";
import { executeWarsztatAction } from "./executor";

/**
 * Wkład modułu do asystenta AI. Ładowany LENIWIE przez pole `ai` w deklaracji — ten plik
 * ciągnie za sobą Server Actions i Prismę, więc nie może trafić do bundla klienta.
 */
const contribution: AiContribution = {
  execute: executeWarsztatAction,
};

export default contribution;
