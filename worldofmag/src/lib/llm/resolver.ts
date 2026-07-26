import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  GROQ_BASE_URL,
  OPERATION_TYPE_META,
  type OperationType,
} from "./operationTypes";

/**
 * Rodzaje dostawców. `openai_compat` i `anthropic` obsługują CZAT (i syntezę mowy w przypadku
 * dostawców zgodnych z OpenAI); trzy pozostałe to dostawcy **wyłącznie syntezy mowy** — mają własny
 * format żądania i nie odpowiedzą na prompt czatowy.
 *
 * Zgodnie z C-12 to zwykły `String` w bazie + zawężający union tutaj — żadnego enuma Prisma.
 */
export type ProviderKind = "openai_compat" | "anthropic" | "elevenlabs" | "google_tts" | "azure_tts";

/** Dostawcy obsługujący WYŁĄCZNIE syntezę mowy — nigdy nie wolno im trafić do wywołania czatu. */
export const SPEECH_ONLY_PROVIDER_KINDS: readonly ProviderKind[] = ["elevenlabs", "google_tts", "azure_tts"];

export function isSpeechOnlyKind(kind: string): boolean {
  return (SPEECH_ONLY_PROVIDER_KINDS as readonly string[]).includes(kind);
}

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
    // 032: dostawca WYŁĄCZNIE syntezy mowy nie może obsłużyć operacji czatowej — `chatComplete`
    // rozgałęzia się tylko na „anthropic vs reszta", więc bez tego filtra wysłałby prompt na
    // endpoint TTS. To druga bariera obok walidacji w `setAssignment` (pas i szelki).
    if (op !== "speech" && isSpeechOnlyKind(p.kind)) {
      console.warn(`[llm] ${op}: pomijam dostawcę ${p.label} — obsługuje wyłącznie syntezę mowy`);
    } else {
      add({
        kind: (p.kind as ProviderKind) ?? "openai_compat",
        baseUrl: p.baseUrl,
        apiKey: decryptSecret(p.apiKey), // A2: klucz zaszyfrowany w spoczynku
        model: assignment.model,
        temperature: assignment.temperature,
        maxTokens: assignment.maxTokens,
      });
    }
  }

  // 2. Fallback: stary, pojedynczy klucz Groq + domyślny model dla typu operacji.
  // 031: typ operacji BEZ domyślnego modelu (np. `speech`) nie ma fallbacku — brak przypisania
  // administratora oznacza, że funkcja jest po prostu wyłączona (a nie „wołana z pustym modelem").
  const legacy = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (legacy?.value && OPERATION_TYPE_META[op].defaultModel) {
    add({
      kind: "openai_compat",
      baseUrl: GROQ_BASE_URL,
      apiKey: decryptSecret(legacy.value),
      model: OPERATION_TYPE_META[op].defaultModel,
    });
  }

  // 3. 017-ai-model-limit-resilience: dla `reasoning` dołóż lżejszy model Groqa jako
  // OSTATNIE ogniwo. Gdy główny model (70b) wyczerpie limit (dzienny TPD lub minutowy
  // TPM), `chatComplete` zdegraduje na lżejszy model (osobny budżet — w logach działał,
  // gdy 70b padał) zamiast oddać użytkownikowi błąd. Dedup w `add()` chroni przed
  // duplikatem (gdy admin ustawił już 8b jako główny). Tylko przy dostępnym kluczu Groqa.
  if (op === "reasoning" && legacy?.value) {
    add({
      kind: "openai_compat",
      baseUrl: GROQ_BASE_URL,
      apiKey: decryptSecret(legacy.value),
      model: OPERATION_TYPE_META.dispatch.defaultModel, // llama-3.1-8b-instant
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
