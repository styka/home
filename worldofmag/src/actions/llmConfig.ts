"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  OPERATION_TYPES,
  OPERATION_TYPE_META,
  isOperationType,
  type OperationType,
} from "@/lib/llm/operationTypes";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { logAudit } from "@/lib/audit";
import { LLM_EFFORT_LABELS, LLM_EFFORT_LEVELS, parseEffort, type LlmEffort } from "@/lib/llm/effort";
import { COST_ALERT_CONFIG_KEY, getDailyCostUsd } from "@/lib/ai/usage";
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
  label: string;
  description: string;
  defaultModel: string;
  providerId: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  /** 032: poziom wysiłku modelu (wspólna skala tłumaczona per dostawca). */
  effort: LlmEffort;
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

export async function createProvider(data: {
  label: string;
  kind: string;
  baseUrl: string;
  apiKey: string;
}): Promise<void> {
  await requireAdmin();
  const label = data.label.trim();
  const baseUrl = data.baseUrl.trim().replace(/\/+$/, "");
  const kind = data.kind === "anthropic" ? "anthropic" : "openai_compat";
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
  if (data.kind !== undefined) patch.kind = data.kind === "anthropic" ? "anthropic" : "openai_compat";
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

export async function getAssignments(): Promise<AssignmentDTO[]> {
  await requireAdmin();
  const rows = await prisma.llmAssignment.findMany();
  const byType = new Map(rows.map((r) => [r.operationType, r]));
  return OPERATION_TYPES.map((op) => {
    const meta = OPERATION_TYPE_META[op];
    const a = byType.get(op);
    return {
      operationType: op,
      label: meta.label,
      description: meta.description,
      defaultModel: meta.defaultModel,
      providerId: a?.providerId ?? null,
      model: a?.model ?? null,
      temperature: a?.temperature ?? null,
      maxTokens: a?.maxTokens ?? null,
      effort: parseEffort(a?.effort),
    };
  });
}

// 032: zakresy walidacji parametrów modelu. Temperatura: skala OpenAI-compatible (0–2).
// Limit odpowiedzi: górna granica z zapasem na najdłuższe raporty, ale chroni przed literówką
// („80000" zamiast „8000") zamieniającą jedno wywołanie w bardzo drogie.
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const MAX_TOKENS_MIN = 1;
const MAX_TOKENS_MAX = 32000;

export async function setAssignment(data: {
  operationType: string;
  providerId: string;
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
  effort?: string | null;
}): Promise<void> {
  await requireAdmin();
  if (!isOperationType(data.operationType)) throw new Error("Nieznany typ operacji");
  const model = data.model.trim();
  if (!data.providerId || !model) throw new Error("Wybierz dostawcę i podaj model");

  // 032: walidacja parametrów modelu — niepoprawna wartość NIE nadpisuje działającej konfiguracji.
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
  const fields = { providerId: data.providerId, model, temperature, maxTokens, effort: effortValue };
  await prisma.llmAssignment.upsert({
    where: { operationType: data.operationType },
    update: fields,
    create: { operationType: data.operationType, ...fields },
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
    data.operationType,
    `Przypisano model „${model}” do operacji ${data.operationType} (${params})`
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
    await prisma.llmAssignment.upsert({
      where: { operationType: op },
      update: { providerId: provider.id, model },
      create: { operationType: op, providerId: provider.id, model },
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
  totalTokens: number;
  latencyMs: number;
  conversationId: string | null;
  errorText: string | null;
  /** 032: poziom wysiłku FAKTYCZNIE użyty (null = parametr nie był wysłany). */
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
      completionTokens: true, totalTokens: true, latencyMs: true, conversationId: true, errorText: true,
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
    totalTokens: r.totalTokens,
    latencyMs: r.latencyMs,
    conversationId: r.conversationId,
    errorText: r.errorText,
    effort: r.effort,
  }));
}
