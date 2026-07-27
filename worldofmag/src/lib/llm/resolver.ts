import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import { parseEffort, type LlmEffort } from "@/lib/llm/effort";
import {
  BASE_CONFIG_LEVEL,
  GROQ_BASE_URL,
  OPERATION_TYPE_META,
  configLevelFor,
  type AssistantWorkLevel,
  type OperationType,
} from "./operationTypes";

/**
 * Rodzaje dostawców. `openai_compat` i `anthropic` obsługują CZAT (i syntezę mowy w przypadku
 * dostawców zgodnych z OpenAI); trzy pozostałe to dostawcy **wyłącznie syntezy mowy** — mają własny
 * format żądania i nie odpowiedzą na prompt czatowy.
 *
 * Zgodnie z C-12 to zwykły `String` w bazie + zawężający union tutaj — żadnego enuma Prisma.
 */
export const PROVIDER_KINDS = ["openai_compat", "anthropic", "elevenlabs", "google_tts", "azure_tts"] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];

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
  /** 033: poziom wysiłku ustawiony przez admina dla tego typu operacji ("none" = nie wysyłaj). */
  effort?: LlmEffort | null;
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
export interface ResolveOptions {
  /** 034: poziom pracy asystenta — wybiera zestaw ustawień admina albo własny zestaw użytkownika. */
  level?: AssistantWorkLevel;
  /** 034: potrzebne tylko dla poziomu `custom` (odczyt `UserLlmPref`). */
  userId?: string;
}

/**
 * 034: składa efektywne ustawienia dla (typ operacji, poziom). Pole puste na poziomie
 * `economy`/`max` DZIEDZICZY z poziomu `standard` — dzięki temu admin wypełnia tylko to, co ma się
 * różnić, a wdrożenie nie zmienia zachowania, dopóki świadomie czegoś nie zmieni.
 */
async function resolveAssignment(op: OperationType, level: AssistantWorkLevel | undefined) {
  const configLevel = configLevelFor(level);
  const rows = await prisma.llmAssignment.findMany({
    where: { operationType: op, level: { in: [configLevel, BASE_CONFIG_LEVEL] } },
    include: { provider: true },
  });
  const own = rows.find((r) => r.level === configLevel) ?? null;
  const base = rows.find((r) => r.level === BASE_CONFIG_LEVEL) ?? null;
  const row = own ?? base;
  if (!row) return null;
  return {
    provider: row.provider,
    model: row.model ?? base?.model ?? null,
    temperature: row.temperature ?? base?.temperature ?? null,
    maxTokens: row.maxTokens ?? base?.maxTokens ?? null,
    effort: row.effort ?? base?.effort ?? null,
  };
}

type ResolvedAssignment = NonNullable<Awaited<ReturnType<typeof resolveAssignment>>>;

/**
 * 034: nakładka WŁASNEGO poziomu użytkownika (`UserLlmPref`). Użytkownik może wskazać model, wysiłek
 * i temperaturę per typ operacji — ale NIE limit odpowiedzi (`maxTokens` zostaje przy adminie).
 *
 * Dostawcę bierzemy po `providerId` zapisanym przy wyborze modelu. Gdy zniknął albo został wyłączony
 * przez admina, po cichu zostajemy przy ustawieniach poziomu standardowego — użytkownik dostaje
 * odpowiedź zamiast błędu (AC-10).
 */
async function applyUserOverride(
  base: ResolvedAssignment,
  op: OperationType,
  opts: ResolveOptions
): Promise<ResolvedAssignment> {
  if (opts.level !== "custom" || !opts.userId) return base;
  const pref = await prisma.userLlmPref.findUnique({
    where: { userId_operationType: { userId: opts.userId, operationType: op } },
  });
  if (!pref) return base;

  let provider = base.provider;
  if (pref.providerId && pref.providerId !== base.provider.id) {
    const chosen = await prisma.llmProvider.findUnique({ where: { id: pref.providerId } });
    if (!chosen || !chosen.enabled || !chosen.apiKey) return base;
    provider = chosen;
  }
  return {
    provider,
    model: pref.model ?? base.model,
    temperature: pref.temperature ?? base.temperature,
    maxTokens: base.maxTokens, // świadomie: limitu odpowiedzi użytkownik nie ustawia
    effort: pref.effort ?? base.effort,
  };
}

export async function resolveLlmChain(op: OperationType, opts: ResolveOptions = {}): Promise<ResolvedLlm[]> {
  const chain: ResolvedLlm[] = [];
  const seen = new Set<string>();
  const add = (cfg: ResolvedLlm | null) => {
    if (!cfg) return;
    const key = `${cfg.kind}|${cfg.baseUrl}|${cfg.model}`;
    if (seen.has(key)) return;
    seen.add(key);
    chain.push(cfg);
  };

  // 1. Przypisanie admina dla wybranego poziomu (z dziedziczeniem po poziomie standardowym),
  //    ewentualnie nadpisane WŁASNYM poziomem użytkownika.
  const resolved = await resolveAssignment(op, opts.level);
  const assignment = resolved && resolved.model
    ? await applyUserOverride(resolved, op, opts)
    : null;
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
        model: assignment.model!,
        temperature: assignment.temperature,
        maxTokens: assignment.maxTokens,
        // 033: poziom wysiłku ustawiony przez admina dla tego typu operacji.
        effort: parseEffort(assignment.effort),
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
export async function resolveLlm(op: OperationType, opts: ResolveOptions = {}): Promise<ResolvedLlm | null> {
  const chain = await resolveLlmChain(op, opts);
  return chain[0] ?? null;
}
