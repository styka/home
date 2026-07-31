"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  BASE_CONFIG_LEVEL,
  CONFIG_LEVEL_LABELS,
  OPERATION_TYPES,
  OPERATION_TYPE_META,
  isConfigLevel,
  isOperationType,
  type ConfigLevel,
  type OperationType,
} from "@/lib/llm/operationTypes";
import { PROVIDER_KINDS, isSpeechOnlyKind, type ProviderKind } from "@/lib/llm/resolver";
import { invalidatePriceCache } from "@/lib/llm/pricing";
import { FOLLOWUPS_CONFIG_KEY, readFollowupsEnabled } from "@/lib/ai/followups";
import { TTS_CATALOG, findTtsProvider, findTtsProviderById, providerMatchesSpec, normalizeBaseUrl } from "@/lib/tts/catalog";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { logAudit } from "@/lib/audit";
import { LLM_EFFORT_LABELS, LLM_EFFORT_LEVELS, parseEffort, type LlmEffort } from "@/lib/llm/effort";
import { COST_ALERT_CONFIG_KEY, getDailyCostUsd, AI_COST_BADGE_CONFIG_KEY } from "@/lib/ai/usage";
import { readCostBadgeEnabled } from "@/lib/ai/costVisibility";
import { USD_PLN_CONFIG_KEY, DEFAULT_USD_PLN_RATE, parseUsdPlnRate } from "@/lib/usdPln";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
}

export interface ProviderDTO {
  id: string;
  label: string;
  kind: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasKey: boolean;
  enabled: boolean;
}

export interface AssignmentDTO {
  operationType: OperationType;
  /** 034: poziom pracy asystenta, którego dotyczy ten wiersz. */
  level: ConfigLevel;
  label: string;
  description: string;
  defaultModel: string;
  providerId: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  /** 033: poziom wysiłku modelu (wspólna skala tłumaczona per dostawca). */
  effort: LlmEffort;
  // 034: co zadziała, gdy pole zostanie puste (dziedziczenie z poziomu standardowego).
  inheritedProviderId: string | null;
  inheritedModel: string | null;
  inheritedTemperature: number | null;
  inheritedMaxTokens: number | null;
  inheritedEffort: LlmEffort | null;
}

export async function getLlmProviders(): Promise<ProviderDTO[]> {
  await requireAdmin();
  const rows = await prisma.llmProvider.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    baseUrl: p.baseUrl,
    // A2: deszyfruj tylko po to, by pokazać maskę (4 ostatnie znaki realnego klucza).
    apiKeyMasked: maskSecret(decryptSecret(p.apiKey)),
    hasKey: Boolean(p.apiKey),
    enabled: p.enabled,
  }));
}

/**
 * 032: normalizacja rodzaju dostawcy. Wcześniej „wszystko, co nie `anthropic` → `openai_compat`",
 * co zjadałoby nowe rodzaje syntezy mowy (ElevenLabs, Google, Azure) i wysyłałoby ich żądania na
 * endpoint zgodny z OpenAI. Nieznana wartość nadal degraduje do `openai_compat`.
 */
function normalizeProviderKind(kind: string | undefined): ProviderKind {
  return PROVIDER_KINDS.includes(kind as ProviderKind) ? (kind as ProviderKind) : "openai_compat";
}

export async function createProvider(data: {
  label: string;
  kind: string;
  baseUrl: string;
  apiKey: string;
}): Promise<void> {
  await requireAdmin();
  const label = data.label.trim();
  const baseUrl = data.baseUrl.trim().replace(/\/+$/, "");
  const kind = normalizeProviderKind(data.kind);
  if (!label || !baseUrl) throw new Error("Nazwa i adres bazowy są wymagane");
  await prisma.llmProvider.create({
    data: { label, kind, baseUrl, apiKey: encryptSecret(data.apiKey.trim()), enabled: true },
  });
  await logAudit("config", "llm_provider.create", label, `Dodano dostawcę LLM „${label}” (${kind})`);
  revalidatePath("/admin/llm");
}

export async function updateProvider(
  id: string,
  data: { label?: string; kind?: string; baseUrl?: string; apiKey?: string; enabled?: boolean }
): Promise<void> {
  await requireAdmin();
  const patch: Record<string, unknown> = {};
  if (data.label !== undefined) patch.label = data.label.trim();
  if (data.baseUrl !== undefined) patch.baseUrl = data.baseUrl.trim().replace(/\/+$/, "");
  if (data.kind !== undefined) patch.kind = normalizeProviderKind(data.kind);
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  // Pusty klucz = nie nadpisuj (pozwala edytować inne pola bez ujawniania klucza).
  if (data.apiKey !== undefined && data.apiKey.trim()) patch.apiKey = encryptSecret(data.apiKey.trim());
  await prisma.llmProvider.update({ where: { id }, data: patch });
  await logAudit("config", "llm_provider.update", id, `Zmieniono dostawcę LLM${data.apiKey?.trim() ? " (w tym klucz)" : ""}`);
  revalidatePath("/admin/llm");
}

export async function deleteProvider(id: string): Promise<void> {
  await requireAdmin();
  const usedBy = await prisma.llmAssignment.count({ where: { providerId: id } });
  if (usedBy > 0) {
    throw new Error("Nie można usunąć — dostawca jest przypisany do typu operacji. Najpierw zmień przypisania.");
  }
  const prov = await prisma.llmProvider.findUnique({ where: { id }, select: { label: true } });
  await prisma.llmProvider.delete({ where: { id } });
  await logAudit("config", "llm_provider.delete", id, `Usunięto dostawcę LLM „${prov?.label ?? id}”`);
  revalidatePath("/admin/llm");
}

/**
 * 034: przypisania dla WSKAZANEGO poziomu. Pole puste na poziomie innym niż standardowy dziedziczy
 * ze standardowego — zwracamy więc obok wartości własnej także `inherited*`, żeby panel mógł
 * pokazać, co realnie zadziała, i oznaczyć to jako dziedziczone (AC-4).
 */
export async function getAssignments(level: string = BASE_CONFIG_LEVEL): Promise<AssignmentDTO[]> {
  await requireAdmin();
  if (!isConfigLevel(level)) throw new Error("Nieznany poziom pracy asystenta");
  const rows = await prisma.llmAssignment.findMany({
    where: { level: { in: [level, BASE_CONFIG_LEVEL] } },
  });
  const own = new Map(rows.filter((r) => r.level === level).map((r) => [r.operationType, r]));
  const base = new Map(rows.filter((r) => r.level === BASE_CONFIG_LEVEL).map((r) => [r.operationType, r]));
  return OPERATION_TYPES.map((op) => {
    const meta = OPERATION_TYPE_META[op];
    const a = own.get(op);
    const b = base.get(op);
    return {
      operationType: op,
      level,
      label: meta.label,
      description: meta.description,
      defaultModel: meta.defaultModel,
      providerId: a?.providerId ?? null,
      model: a?.model ?? null,
      temperature: a?.temperature ?? null,
      maxTokens: a?.maxTokens ?? null,
      effort: parseEffort(a?.effort),
      // Co zadziała, gdy pole zostanie puste (null = też nic, czyli fallback wbudowany).
      inheritedProviderId: level === BASE_CONFIG_LEVEL ? null : b?.providerId ?? null,
      inheritedModel: level === BASE_CONFIG_LEVEL ? null : b?.model ?? null,
      inheritedTemperature: level === BASE_CONFIG_LEVEL ? null : b?.temperature ?? null,
      inheritedMaxTokens: level === BASE_CONFIG_LEVEL ? null : b?.maxTokens ?? null,
      inheritedEffort: level === BASE_CONFIG_LEVEL ? null : parseEffort(b?.effort),
    };
  });
}

// 033: zakresy walidacji parametrów modelu. Temperatura: skala OpenAI-compatible (0–2).
// Limit odpowiedzi: górna granica z zapasem na najdłuższe raporty, ale chroni przed literówką
// („80000" zamiast „8000") zamieniającą jedno wywołanie w bardzo drogie.
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const MAX_TOKENS_MIN = 1;
const MAX_TOKENS_MAX = 32000;
// 034: granice cennika — chronią przed literówką („30" zamiast „3" USD za 1M tokenów), która
// cicho przekłamałaby wszystkie kwoty pokazywane użytkownikowi.
const PRICE_PER_1M_MAX = 1000;
const CACHE_MULT_MAX = 10;

export async function setAssignment(data: {
  operationType: string;
  /** 034: poziom pracy asystenta, którego dotyczy zapis (domyślnie standardowy). */
  level?: string;
  providerId: string;
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
  effort?: string | null;
}): Promise<void> {
  await requireAdmin();
  if (!isOperationType(data.operationType)) throw new Error("Nieznany typ operacji");
  const level = data.level ?? BASE_CONFIG_LEVEL;
  if (!isConfigLevel(level)) throw new Error("Nieznany poziom pracy asystenta");
  const model = data.model.trim();
  if (!data.providerId) throw new Error("Wybierz dostawcę");
  // 034: pusty model na poziomie innym niż standardowy = świadome DZIEDZICZENIE ze standardowego.
  if (!model && level === BASE_CONFIG_LEVEL) throw new Error("Podaj model dla poziomu standardowego");

  // 032: dostawca obsługujący WYŁĄCZNIE syntezę mowy nie może zostać przypisany do operacji
  // czatowej — jego endpoint nie odpowiada na prompt. Blokujemy to już przy zapisie, żeby
  // administrator dowiedział się od razu, a nie z błędu asystenta (druga bariera: `resolveLlmChain`).
  if (data.operationType !== "speech") {
    const provider = await prisma.llmProvider.findUnique({
      where: { id: data.providerId },
      select: { kind: true, label: true },
    });
    if (provider && isSpeechOnlyKind(provider.kind)) {
      throw new Error(
        `Dostawca „${provider.label}” obsługuje wyłącznie syntezę mowy — nie da się go przypisać do tego typu operacji.`
      );
    }
  }

  // 033: walidacja parametrów modelu — niepoprawna wartość NIE nadpisuje działającej konfiguracji.
  if (data.effort != null && data.effort !== "" && !LLM_EFFORT_LEVELS.includes(data.effort as LlmEffort)) {
    throw new Error("Nieznany poziom wysiłku modelu.");
  }
  const effort = data.effort ? parseEffort(data.effort) : "none";

  const temperature = data.temperature ?? null;
  if (temperature !== null) {
    if (!Number.isFinite(temperature) || temperature < TEMPERATURE_MIN || temperature > TEMPERATURE_MAX) {
      throw new Error(`Temperatura musi być liczbą z zakresu ${TEMPERATURE_MIN}–${TEMPERATURE_MAX}.`);
    }
  }
  const maxTokens = data.maxTokens ?? null;
  if (maxTokens !== null) {
    if (!Number.isInteger(maxTokens) || maxTokens < MAX_TOKENS_MIN || maxTokens > MAX_TOKENS_MAX) {
      throw new Error(`Limit odpowiedzi musi być liczbą całkowitą z zakresu ${MAX_TOKENS_MIN}–${MAX_TOKENS_MAX} tokenów.`);
    }
  }

  // "none" zapisujemy jako NULL — kolumna pusta znaczy „nie wysyłaj parametru".
  const effortValue = effort === "none" ? null : effort;
  const fields = { providerId: data.providerId, model: model || null, temperature, maxTokens, effort: effortValue };
  await prisma.llmAssignment.upsert({
    where: { operationType_level: { operationType: data.operationType, level } },
    update: fields,
    create: { operationType: data.operationType, level, ...fields },
  });

  // C-25: opis w audycie mówi też, z jakimi parametrami — inaczej nie da się odtworzyć zmiany.
  const params = [
    `wysiłek: ${LLM_EFFORT_LABELS[effort]}`,
    temperature !== null ? `temperatura: ${temperature}` : "temperatura: domyślna",
    maxTokens !== null ? `limit: ${maxTokens} tok.` : "limit: domyślny",
  ].join(", ");
  await logAudit(
    "config",
    "llm_assignment.set",
    `${data.operationType}:${level}`,
    `Poziom „${CONFIG_LEVEL_LABELS[level]}”: przypisano model „${model || "(dziedziczony)"}” do operacji ${data.operationType} (${params})`
  );
  revalidatePath("/admin/llm");
}

// ─── 032: konfiguracja syntezy mowy (lektor asystenta) ───────────────────────
//
// Administrator nie ma znać z pamięci dostawców, modeli ani nazw głosów. Panel dostaje gotowe listy
// z katalogu (`src/lib/tts/catalog.ts`), informację o koszcie i wymaganiach oraz możliwość dopisania
// brakującego klucza w tym samym miejscu. Wybór dalej ląduje w bazie (C-40) — katalog jest tylko
// słownikiem podpowiedzi.

/** Klucz `Config` z domyślnym głosem lektora wybranym przez administratora (jawny, nie sekret). */
const SPEECH_VOICE_CONFIG_KEY = "speech_default_voice";

export interface SpeechCatalogEntryDTO {
  id: string;
  label: string;
  kind: string;
  baseUrl: string;
  models: { id: string; label: string }[];
  voices: { id: string; label: string; description: string }[];
  paid: boolean;
  costHint: string;
  requiresKey: boolean;
  polishHint: string;
  setupHint: string;
  /** Czy dla tej pozycji istnieje już dostawca w bazie… */
  providerExists: boolean;
  /** …i czy ma zapisany klucz (samego klucza NIGDY nie zwracamy — C-41). */
  hasKey: boolean;
}

export interface SpeechConfigDTO {
  catalog: SpeechCatalogEntryDTO[];
  /** Pozycja katalogu odpowiadająca obecnemu przypisaniu (albo null, gdy lektor jest wyłączony). */
  currentCatalogId: string | null;
  currentModel: string | null;
  currentVoiceId: string | null;
}

export async function getSpeechConfig(): Promise<SpeechConfigDTO> {
  await requireAdmin();
  const providers = await prisma.llmProvider.findMany({ select: { kind: true, baseUrl: true, apiKey: true } });
  const assignment = await prisma.llmAssignment.findUnique({
    where: { operationType_level: { operationType: "speech", level: BASE_CONFIG_LEVEL } },
    include: { provider: { select: { kind: true, baseUrl: true } } },
  });
  const voiceRow = await prisma.config.findUnique({ where: { key: SPEECH_VOICE_CONFIG_KEY } });

  const catalog: SpeechCatalogEntryDTO[] = TTS_CATALOG.map((spec) => {
    const match = providers.find((p) => providerMatchesSpec(p, spec));
    return {
      id: spec.id,
      label: spec.label,
      kind: spec.kind,
      baseUrl: spec.baseUrl,
      models: spec.models,
      voices: spec.voices,
      paid: spec.paid,
      costHint: spec.costHint,
      requiresKey: spec.requiresKey,
      polishHint: spec.polishHint,
      setupHint: spec.setupHint,
      providerExists: !!match,
      hasKey: !!match?.apiKey,
    };
  });

  const current = assignment ? findTtsProvider(assignment.provider.kind, assignment.provider.baseUrl) : undefined;
  return {
    catalog,
    currentCatalogId: current?.id ?? null,
    currentModel: assignment?.model ?? null,
    currentVoiceId: voiceRow?.value ?? null,
  };
}

/**
 * Ustawia lektora „jednym zapisem": upsert dostawcy z danych KATALOGU (nie z wejścia klienta),
 * przypisanie modelu do typu operacji `speech` i domyślny głos. Wzorzec 1:1 z `applyAnthropicProfile`.
 *
 * Pusty `apiKey` nie nadpisuje istniejącego klucza (pozwala zmienić model/głos bez wpisywania klucza
 * od nowa). Głos spoza listy dostawcy → zapisujemy jego głos domyślny, nigdy obcą nazwę (AC-7).
 */
export async function applySpeechProvider(data: {
  catalogId: string;
  apiKey?: string;
  model: string;
  voiceId?: string | null;
  /** Adres bazowy — tylko dla Azure, gdzie zależy od regionu wybranego przez administratora. */
  baseUrl?: string;
}): Promise<void> {
  await requireAdmin();
  const spec = findTtsProviderById(data.catalogId);
  if (!spec) throw new Error("Nieznany dostawca syntezy mowy.");

  const model = data.model.trim();
  if (!spec.models.some((m) => m.id === model)) {
    throw new Error("Wybierz model z listy dostępnej dla tego dostawcy.");
  }

  const baseUrl = normalizeBaseUrl(data.baseUrl?.trim() || spec.baseUrl);
  const apiKey = data.apiKey?.trim();

  // 032: szukamy dostawcy odpowiadającego TEJ pozycji katalogu (rodzaj + adres), nie pierwszego
  // o tym samym rodzaju — inaczej zapis lektora OpenAI przestawiał adres istniejącego Groqa i
  // wyłączał czat. `providerMatchesSpec` dopuszcza rozjazd adresu tylko dla rodzajów jednoznacznych
  // (np. inny region Azure), więc tam nadal aktualizujemy w miejscu zamiast mnożyć wiersze.
  const candidates = await prisma.llmProvider.findMany({
    where: { kind: spec.kind },
    orderBy: { createdAt: "asc" },
  });
  let provider = candidates.find((p) => providerMatchesSpec(p, { kind: spec.kind, baseUrl })) ?? null;
  if (provider) {
    await prisma.llmProvider.update({
      where: { id: provider.id },
      data: { baseUrl, enabled: true, ...(apiKey ? { apiKey: encryptSecret(apiKey) } : {}) },
    });
  } else {
    if (spec.requiresKey && !apiKey) {
      throw new Error(`Dostawca „${spec.label}” wymaga klucza API — podaj go, żeby włączyć lektora.`);
    }
    provider = await prisma.llmProvider.create({
      data: { label: spec.label, kind: spec.kind, baseUrl, apiKey: encryptSecret(apiKey ?? ""), enabled: true },
    });
  }

  await prisma.llmAssignment.upsert({
    where: { operationType_level: { operationType: "speech", level: BASE_CONFIG_LEVEL } },
    update: { providerId: provider.id, model },
    create: { operationType: "speech", level: BASE_CONFIG_LEVEL, providerId: provider.id, model },
  });

  // Głos walidujemy wprost przeciw TEJ pozycji katalogu — mamy `spec`, więc nie ma po co pytać
  // katalogu drugi raz (i nie ma ryzyka trafienia w inną pozycję o tym samym rodzaju).
  const voiceId = spec.voices.some((v) => v.id === data.voiceId) ? data.voiceId! : (spec.voices[0]?.id ?? null);
  if (voiceId) {
    await prisma.config.upsert({
      where: { key: SPEECH_VOICE_CONFIG_KEY },
      update: { value: voiceId },
      create: { key: SPEECH_VOICE_CONFIG_KEY, value: voiceId },
    });
  }

  await logAudit(
    "config",
    "llm_speech.set",
    provider.id,
    `Ustawiono lektora: ${spec.label}, model „${model}”${voiceId ? `, głos „${voiceId}”` : ""}${apiKey ? " (w tym klucz)" : ""}`
  );
  revalidatePath("/admin/llm");
}

// ─── 002-ai-architecture: obserwowalność kosztów + profil Anthropic ──────────

export interface AiCostRow {
  model: string;
  operationType: string;
  providerKind: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface AiCostBreakdown {
  days: number;
  totalCostUsd: number;
  totalCalls: number;
  todayCostUsd: number;
  rows: AiCostRow[];
}

/** Rozbicie zużycia AI z `AiCall` per model + typ operacji (koszt SZACOWANY). */
export async function getAiCostBreakdown(days = 30): Promise<AiCostBreakdown> {
  await requireAdmin();
  const since = new Date(Date.now() - days * 86_400_000);
  const grouped = await prisma.aiCall.groupBy({
    by: ["model", "operationType", "providerKind"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    _sum: {
      promptTokens: true,
      completionTokens: true,
      cacheReadTokens: true,
      totalTokens: true,
      costUsd: true,
    },
    _avg: { latencyMs: true },
  });
  const rows: AiCostRow[] = grouped
    .map((g) => ({
      model: g.model,
      operationType: g.operationType,
      providerKind: g.providerKind,
      calls: g._count._all,
      promptTokens: g._sum.promptTokens ?? 0,
      completionTokens: g._sum.completionTokens ?? 0,
      cacheReadTokens: g._sum.cacheReadTokens ?? 0,
      totalTokens: g._sum.totalTokens ?? 0,
      costUsd: g._sum.costUsd ?? 0,
      avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const totalCostUsd = rows.reduce((s, r) => s + r.costUsd, 0);
  const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
  const todayCostUsd = await getDailyCostUsd();
  return { days, totalCostUsd, totalCalls, todayCostUsd, rows };
}

/** Dzienny próg alertu kosztowego (USD); 0 = wyłączony. */
export async function getCostAlertThreshold(): Promise<number> {
  await requireAdmin();
  const row = await prisma.config.findUnique({ where: { key: COST_ALERT_CONFIG_KEY } });
  const n = row?.value ? Number(row.value) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function setCostAlertThreshold(usd: number): Promise<void> {
  await requireAdmin();
  const value = Number.isFinite(usd) && usd > 0 ? String(usd) : "0";
  await prisma.config.upsert({
    where: { key: COST_ALERT_CONFIG_KEY },
    update: { value },
    create: { key: COST_ALERT_CONFIG_KEY, value },
  });
  await logAudit("config", "ai_cost_alert.set", COST_ALERT_CONFIG_KEY, `Ustawiono dzienny próg kosztów AI na $${value}`);
  revalidatePath("/admin/llm");
}

/** 029: przelicznik USD→PLN (kwoty USD pokazujemy z równowartością PLN). Domyślnie 3,81. */
export async function getUsdPlnRate(): Promise<number> {
  await requireAdmin();
  const row = await prisma.config.findUnique({ where: { key: USD_PLN_CONFIG_KEY } });
  return parseUsdPlnRate(row?.value, DEFAULT_USD_PLN_RATE);
}

export async function setUsdPlnRate(rate: number): Promise<void> {
  await requireAdmin();
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Przelicznik musi być liczbą dodatnią.");
  const value = String(rate);
  await prisma.config.upsert({
    where: { key: USD_PLN_CONFIG_KEY },
    update: { value },
    create: { key: USD_PLN_CONFIG_KEY, value },
  });
  await logAudit("config", "usd_pln_rate.set", USD_PLN_CONFIG_KEY, `Ustawiono przelicznik USD→PLN na ${value}`);
  // Kwoty PLN pojawiają się w wielu miejscach — odśwież panele, które je pokazują.
  revalidatePath("/admin/llm");
  revalidatePath("/admin/metrics");
}

// Rekomendowany profil Anthropic: Sonnet do rozumowania/generowania, Haiku do
// klasyfikacji (dispatch). Modele są potem edytowalne w tabeli przypisań.
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_MODELS = {
  reasoning: "claude-sonnet-5",
  generation: "claude-sonnet-5",
  vision: "claude-sonnet-5",
  dispatch: "claude-haiku-4-5",
} as const satisfies Partial<Record<OperationType, string>>;

/**
 * Jednoklikowy profil „Anthropic (Sonnet + Haiku)": dodaje/aktualizuje dostawcę
 * Anthropic i przypisuje modele do typów operacji. NIE usuwa Groqa — zostaje jako
 * fallback w łańcuchu resolvera, więc środowisko bez klucza Anthropic dalej działa.
 */
export async function applyAnthropicProfile(data: { apiKey: string }): Promise<void> {
  await requireAdmin();
  const apiKey = data.apiKey.trim();
  if (!apiKey) throw new Error("Podaj klucz API Anthropic");

  // Znajdź istniejącego dostawcę Anthropic albo utwórz nowego.
  let provider = await prisma.llmProvider.findFirst({
    where: { kind: "anthropic" },
    orderBy: { createdAt: "asc" },
  });
  if (provider) {
    await prisma.llmProvider.update({
      where: { id: provider.id },
      data: { apiKey: encryptSecret(apiKey), enabled: true, baseUrl: ANTHROPIC_BASE_URL },
    });
  } else {
    provider = await prisma.llmProvider.create({
      data: {
        label: "Anthropic (Sonnet + Haiku)",
        kind: "anthropic",
        baseUrl: ANTHROPIC_BASE_URL,
        apiKey: encryptSecret(apiKey),
        enabled: true,
      },
    });
  }

  for (const op of OPERATION_TYPES) {
    // 031: Anthropic nie ma syntezy mowy — typ operacji bez modelu w profilu pomijamy
    // (admin przypisze dla niego dostawcę osobno albo funkcja zostaje wyłączona).
    const model = (ANTHROPIC_MODELS as Partial<Record<OperationType, string>>)[op];
    if (!model) continue;
    // 034: profil ustawia poziom STANDARDOWY — pozostałe poziomy z niego dziedziczą.
    await prisma.llmAssignment.upsert({
      where: { operationType_level: { operationType: op, level: BASE_CONFIG_LEVEL } },
      update: { providerId: provider.id, model },
      create: { operationType: op, level: BASE_CONFIG_LEVEL, providerId: provider.id, model },
    });
  }
  await logAudit(
    "config",
    "llm_profile.anthropic",
    provider.id,
    "Zastosowano profil Anthropic (Sonnet dla reasoning/generation/vision, Haiku dla dispatch)"
  );
  revalidatePath("/admin/llm");
}

// ─── 036: propozycje kolejnych pytań („follow-upy") ─────────────────────────
//
// Model dopisuje je do KAŻDEJ odpowiedzi, więc kosztują tokeny przy każdej wiadomości. Administrator
// steruje nimi stąd; wartość żyje w `Config` (wzorzec 1:1 z progiem alertu kosztowego).

export async function getFollowupsEnabled(): Promise<boolean> {
  await requireAdmin();
  return readFollowupsEnabled();
}

export async function setFollowupsEnabled(enabled: boolean): Promise<void> {
  await requireAdmin();
  const value = enabled ? "1" : "0";
  await prisma.config.upsert({
    where: { key: FOLLOWUPS_CONFIG_KEY },
    update: { value },
    create: { key: FOLLOWUPS_CONFIG_KEY, value },
  });
  await logAudit(
    "config",
    "assistant_followups.set",
    FOLLOWUPS_CONFIG_KEY,
    `${enabled ? "Włączono" : "Wyłączono"} propozycje kolejnych pytań w odpowiedziach asystenta`
  );
  revalidatePath("/admin/llm");
}

// ─── 037: widoczność licznika kosztu AI w aplikacji ─────────────────────────
//
// Licznik pokazuje się przy KAŻDEJ treści wygenerowanej przez model — w asystencie i we wszystkich
// modułach. Dla właściciela to przejrzystość wydatku, ale w niektórych sytuacjach (pokaz, praca z
// kimś przy ekranie) lepiej go zgasić. Wartość żyje w `Config`, wzorzec 1:1 z follow-upami.

export async function getCostBadgeEnabled(): Promise<boolean> {
  await requireAdmin();
  return readCostBadgeEnabled();
}

export async function setCostBadgeEnabled(enabled: boolean): Promise<void> {
  await requireAdmin();
  const value = enabled ? "1" : "0";
  await prisma.config.upsert({
    where: { key: AI_COST_BADGE_CONFIG_KEY },
    update: { value },
    create: { key: AI_COST_BADGE_CONFIG_KEY, value },
  });
  await logAudit(
    "config",
    "ai_cost_badge.set",
    AI_COST_BADGE_CONFIG_KEY,
    `${enabled ? "Włączono" : "Wyłączono"} licznik kosztu AI w aplikacji`
  );
  revalidatePath("/admin/llm");
}

// ─── 034: cennik modeli (podstawa liczenia kosztów) ─────────────────────────
//
// Cennik był zaszyty w kodzie, więc zmiana stawki wymagała wdrożenia nowej wersji, a model spoza
// listy „kosztował 0". Teraz stawki edytuje administrator, a `lib/llm/pricing.ts` czyta je z bazy.

export interface ModelPriceDTO {
  id: string;
  modelPrefix: string;
  label: string | null;
  inputPer1M: number;
  outputPer1M: number;
  cacheReadMult: number;
  cacheWriteMult: number;
}

export async function getModelPrices(): Promise<ModelPriceDTO[]> {
  await requireAdmin();
  const rows = await prisma.llmModelPrice.findMany({ orderBy: { modelPrefix: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    modelPrefix: r.modelPrefix,
    label: r.label,
    inputPer1M: r.inputPer1M,
    outputPer1M: r.outputPer1M,
    cacheReadMult: r.cacheReadMult,
    cacheWriteMult: r.cacheWriteMult,
  }));
}

export async function setModelPrice(data: {
  modelPrefix: string;
  label?: string | null;
  inputPer1M: number;
  outputPer1M: number;
  cacheReadMult?: number;
  cacheWriteMult?: number;
}): Promise<void> {
  await requireAdmin();
  const modelPrefix = data.modelPrefix.trim();
  if (!modelPrefix) throw new Error("Podaj początek nazwy modelu (np. „claude-haiku-4-5”)");

  // Ceny walidujemy PRZED zapisem — zła stawka cicho przekłamywałaby wszystkie koszty.
  const rate = (value: number, name: string): number => {
    if (!Number.isFinite(value) || value < 0 || value > PRICE_PER_1M_MAX) {
      throw new Error(`${name} musi być liczbą z zakresu 0–${PRICE_PER_1M_MAX} USD za milion tokenów.`);
    }
    return value;
  };
  const mult = (value: number | undefined, fallback: number, name: string): number => {
    if (value === undefined) return fallback;
    if (!Number.isFinite(value) || value < 0 || value > CACHE_MULT_MAX) {
      throw new Error(`${name} musi być liczbą z zakresu 0–${CACHE_MULT_MAX}.`);
    }
    return value;
  };

  const fields = {
    label: data.label?.trim() || null,
    inputPer1M: rate(data.inputPer1M, "Cena wejścia"),
    outputPer1M: rate(data.outputPer1M, "Cena wyjścia"),
    cacheReadMult: mult(data.cacheReadMult, 0.1, "Mnożnik odczytu z cache"),
    cacheWriteMult: mult(data.cacheWriteMult, 1.25, "Mnożnik zapisu do cache"),
  };
  await prisma.llmModelPrice.upsert({
    where: { modelPrefix },
    update: fields,
    create: { modelPrefix, ...fields },
  });
  invalidatePriceCache();
  await logAudit(
    "config",
    "llm_price.set",
    modelPrefix,
    `Ustawiono cennik modelu „${modelPrefix}”: wejście ${fields.inputPer1M} / wyjście ${fields.outputPer1M} USD za 1M tokenów`
  );
  revalidatePath("/admin/llm");
}

export async function deleteModelPrice(id: string): Promise<void> {
  await requireAdmin();
  const row = await prisma.llmModelPrice.findUnique({ where: { id }, select: { modelPrefix: true } });
  await prisma.llmModelPrice.delete({ where: { id } });
  invalidatePriceCache();
  await logAudit("config", "llm_price.delete", id, `Usunięto cennik modelu „${row?.modelPrefix ?? id}”`);
  revalidatePath("/admin/llm");
}

// ─── Diagnostyka asystenta AI: surowy log wywołań LLM (per rozmowa) ──────────
export interface AiCallLogRow {
  id: string;
  createdAt: string; // ISO
  source: string | null;
  operationType: string;
  providerKind: string;
  model: string;
  ok: boolean;
  status: number | null;
  attempts: number;
  promptTokens: number;
  completionTokens: number;
  /** 034: tokeny pamięci podręcznej promptu — rozliczane, więc bez nich kwota jest nie do sprawdzenia. */
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  latencyMs: number;
  conversationId: string | null;
  errorText: string | null;
  /** 033: poziom wysiłku FAKTYCZNIE użyty (null = parametr nie był wysłany). */
  effort: string | null;
}

/**
 * Ostatnie wywołania LLM z `AiCall` — do panelu diagnostycznego asystenta.
 * Gdy podano `conversationId`, filtruje po jednej rozmowie (przebieg krok po kroku).
 * Zawiera także wywołania NIEUDANE (status/errorText), których wcześniej nie logowano.
 */
export async function getRecentAiCalls(opts?: {
  conversationId?: string;
  limit?: number;
}): Promise<AiCallLogRow[]> {
  await requireAdmin();
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  const convId = opts?.conversationId?.trim();
  const rows = await prisma.aiCall.findMany({
    where: convId ? { conversationId: convId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, createdAt: true, source: true, operationType: true, providerKind: true,
      model: true, ok: true, status: true, attempts: true, promptTokens: true,
      completionTokens: true, cacheReadTokens: true, cacheWriteTokens: true,
      totalTokens: true, latencyMs: true, conversationId: true, errorText: true,
      effort: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    source: r.source,
    operationType: r.operationType,
    providerKind: r.providerKind,
    model: r.model,
    ok: r.ok,
    status: r.status,
    attempts: r.attempts,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    cacheReadTokens: r.cacheReadTokens,
    cacheWriteTokens: r.cacheWriteTokens,
    totalTokens: r.totalTokens,
    latencyMs: r.latencyMs,
    conversationId: r.conversationId,
    errorText: r.errorText,
    effort: r.effort,
  }));
}
