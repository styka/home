import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  GROQ_BASE_URL,
  OPERATION_TYPE_META,
  type OperationType,
} from "./operationTypes";

export type ProviderKind = "openai_compat" | "anthropic";

export interface ResolvedLlm {
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
}

/**
 * Zwraca konfigurację modelu dla danego typu operacji.
 *
 * Kolejność rozwiązywania:
 *  1. Przypisanie z panelu admina (LlmAssignment → LlmProvider).
 *  2. Fallback wsteczny: dostawca Groq z `Config.groq_api_key` i domyślny
 *     model dla danego typu (zachowuje działanie sprzed refaktoru).
 *
 * Zwraca `null`, gdy nie ma żadnej skonfigurowanej drogi (brak klucza) —
 * trasa powinna wtedy zwrócić błąd konfiguracji (503) lub zdegradować się
 * łagodnie, tak jak dotychczas.
 */
export async function resolveLlm(op: OperationType): Promise<ResolvedLlm | null> {
  const assignment = await prisma.llmAssignment.findUnique({
    where: { operationType: op },
    include: { provider: true },
  });

  if (assignment && assignment.provider.enabled && assignment.provider.apiKey) {
    const p = assignment.provider;
    return {
      kind: (p.kind as ProviderKind) ?? "openai_compat",
      baseUrl: p.baseUrl,
      apiKey: decryptSecret(p.apiKey), // A2: klucz zaszyfrowany w spoczynku
      model: assignment.model,
      temperature: assignment.temperature,
      maxTokens: assignment.maxTokens,
    };
  }

  // Fallback: stary, pojedynczy klucz Groq.
  const legacy = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (legacy?.value) {
    return {
      kind: "openai_compat",
      baseUrl: GROQ_BASE_URL,
      apiKey: decryptSecret(legacy.value),
      model: OPERATION_TYPE_META[op].defaultModel,
    };
  }

  return null;
}
