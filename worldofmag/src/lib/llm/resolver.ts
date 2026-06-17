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
 * Z-133 — łańcuch konfiguracji modeli dla danego typu operacji, w kolejności prób:
 *  1. Przypisanie z panelu admina (LlmAssignment → LlmProvider).
 *  2. Fallback wsteczny: dostawca Groq z `Config.groq_api_key` i domyślny
 *     model dla danego typu (zachowuje działanie sprzed refaktoru).
 *
 * `chatComplete` przechodzi po łańcuchu i przy błędzie przejściowym (429/5xx/sieć)
 * przełącza się na kolejny wpis — awaria/limit jednego dostawcy nie wywala AI.
 * Wpisy są deduplikowane (kind|baseUrl|model), więc gdy admin używa już Groqa z
 * domyślnym modelem, nie ma sztucznego „fallbacku na to samo".
 */
export async function resolveLlmChain(op: OperationType): Promise<ResolvedLlm[]> {
  const chain: ResolvedLlm[] = [];
  const seen = new Set<string>();
  const add = (cfg: ResolvedLlm | null) => {
    if (!cfg) return;
    const key = `${cfg.kind}|${cfg.baseUrl}|${cfg.model}`;
    if (seen.has(key)) return;
    seen.add(key);
    chain.push(cfg);
  };

  // 1. Przypisanie admina.
  const assignment = await prisma.llmAssignment.findUnique({
    where: { operationType: op },
    include: { provider: true },
  });
  if (assignment && assignment.provider.enabled && assignment.provider.apiKey) {
    const p = assignment.provider;
    add({
      kind: (p.kind as ProviderKind) ?? "openai_compat",
      baseUrl: p.baseUrl,
      apiKey: decryptSecret(p.apiKey), // A2: klucz zaszyfrowany w spoczynku
      model: assignment.model,
      temperature: assignment.temperature,
      maxTokens: assignment.maxTokens,
    });
  }

  // 2. Fallback: stary, pojedynczy klucz Groq + domyślny model dla typu operacji.
  const legacy = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (legacy?.value) {
    add({
      kind: "openai_compat",
      baseUrl: GROQ_BASE_URL,
      apiKey: decryptSecret(legacy.value),
      model: OPERATION_TYPE_META[op].defaultModel,
    });
  }

  return chain;
}

/**
 * Zwraca pierwszą (preferowaną) konfigurację modelu dla typu operacji, albo
 * `null`, gdy nic nie jest skonfigurowane (brak klucza). Zachowuje dotychczasowe
 * zachowanie dla wywołań, które nie potrzebują łańcucha fallbacku (np. streaming
 * jednego dostawcy).
 */
export async function resolveLlm(op: OperationType): Promise<ResolvedLlm | null> {
  const chain = await resolveLlmChain(op);
  return chain[0] ?? null;
}
