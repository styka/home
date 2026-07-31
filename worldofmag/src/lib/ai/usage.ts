import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/plans";
import { estimateCost, estimateCostUsd } from "@/lib/llm/pricing";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyUser } from "@/lib/notify";
import { getUsdPlnRate } from "@/lib/usdPlnRate";
import { withPln } from "@/lib/usdPln";
import type { TokenUsage } from "@/lib/llm/chat";

/**
 * 028: lekki akumulator zużycia dla JEDNEJ odpowiedzi asystenta — sumuje tokeny i
 * SZACOWANY koszt (USD) ze WSZYSTKICH wywołań modelu w obrębie jednej tury (router
 * modułów + fast-path + pętla agenta), żeby pokazać użytkownikowi realny koszt w
 * oknie czatu (wskaźnik `MetaFooter`). Koszt liczymy identycznie jak `recordAiCall`
 * (ten sam `estimateCostUsd`), więc wskaźnik zgadza się z sumą wpisów w `AiCall`.
 */
/**
 * 029: pojedyncze wywołanie modelu w obrębie jednej odpowiedzi asystenta — do
 * czytelnego rozbicia kosztu w oknie czatu (panel `CostBreakdown`). `label` jest
 * czysto informacyjny (np. "router" / "fast_path" / "agent").
 */
export type UsageCall = {
  model: string;
  label?: string;
  /** 034: typ operacji (dispatch/reasoning/…) — pokazujemy go w rozbiciu kosztu. */
  operationType?: string;
  promptTokens: number;
  completionTokens: number;
  /** 034: tokeny ODCZYTANE z cache promptu — rozliczane taniej, ale rozliczane. */
  cacheReadTokens: number;
  /** 034: tokeny ZAPISANE do cache promptu — rozliczane DROŻEJ niż zwykłe wejście. */
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
  /** 034: `false` = model spoza cennika → „koszt nieznany", a nie „koszt zerowy". */
  costKnown: boolean;
};

export type UsageMeter = {
  model?: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  /** 034: `false`, gdy CHOĆ JEDNO wywołanie użyło modelu spoza cennika (suma jest zaniżona). */
  costKnown: boolean;
  // 029: rozbicie per wywołanie — suma `costUsd` z `calls` == `meter.costUsd`.
  calls: UsageCall[];
};

export function newUsageMeter(): UsageMeter {
  return { tokens: 0, promptTokens: 0, completionTokens: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, costKnown: true, calls: [] };
}

/** Dolicza jedno wywołanie modelu do akumulatora (bezpieczne przy braku `usage`). */
export function accrueUsage(
  meter: UsageMeter,
  usage: TokenUsage | undefined,
  model?: string,
  label?: string,
  operationType?: string
): void {
  if (model) meter.model = model;
  if (!usage) return;
  meter.tokens += usage.total;
  meter.promptTokens += usage.prompt;
  meter.completionTokens += usage.completion;
  meter.cacheRead += usage.cacheRead ?? 0;
  meter.cacheWrite += usage.cacheWrite ?? 0;
  const cost = estimateCost(
    {
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
      cacheReadTokens: usage.cacheRead,
      cacheWriteTokens: usage.cacheWrite,
    },
    model ?? ""
  );
  meter.costUsd += cost.usd;
  if (!cost.known) meter.costKnown = false;
  // 029: dopisz wpis do rozbicia (suma tych wpisów == meter.costUsd).
  // 034: razem z tokenami cache — bez nich kwoty w rozbiciu wyglądały na wzięte z sufitu.
  meter.calls.push({
    model: model ?? "?",
    label,
    operationType,
    promptTokens: usage.prompt,
    completionTokens: usage.completion,
    cacheReadTokens: usage.cacheRead ?? 0,
    cacheWriteTokens: usage.cacheWrite ?? 0,
    totalTokens: usage.total,
    costUsd: cost.usd,
    costKnown: cost.known,
  });
}

// ─── 037: zużycie do pokazania PRZY TREŚCI (licznik kosztu poza asystentem) ──
//
// Asystent budował `UsageMeter` ręcznie w swojej pętli. Moduły (pogoda, kuchnia, magazyn…) wołają
// model raz albo dwa razy i potrzebują tego samego kształtu — bez przepisywania akumulatora u siebie.
// `usageFromChat` jest jedynym mostem `ChatResult[] → UsageMeter`, więc kwota pokazana użytkownikowi
// liczy się dokładnie tak samo jak wpisy w `AiCall` (ten sam `estimateCost` pod spodem).

/** Klucz w `Config` sterujący widocznością licznika kosztu w całej aplikacji (patrz `costVisibility.ts`). */
export const AI_COST_BADGE_CONFIG_KEY = "ai_cost_badge_enabled";

/**
 * Zużycie jednej operacji AI w postaci nadającej się do przesłania na klienta i zapisania w bazie.
 * Świadomie ten sam kształt co `UsageMeter` — komponent `AiCostBadge` przyjmuje go bez tłumaczenia.
 */
export type AiUsageInfo = UsageMeter;

/** Wynik `chatComplete` w kształcie, którego potrzebuje licznik (bez wariantu błędu). */
type ChatUsageSource = {
  ok: boolean;
  model?: string;
  usage?: TokenUsage;
};

/**
 * Buduje zużycie z jednego lub kilku wywołań modelu. Wywołania nieudane i takie, w których dostawca
 * nie zwrócił zużycia, są pomijane — pokazanie „0 zł" za nieudaną próbę byłoby myleniem użytkownika.
 * Gdy nie ma czego pokazać, zwraca `undefined`, żeby `AiCostBadge` po prostu się nie renderował.
 */
export function usageFromChat(
  entries: Array<{ res: ChatUsageSource; label?: string; op?: string }>
): AiUsageInfo | undefined {
  const meter = newUsageMeter();
  let counted = 0;
  for (const e of entries) {
    if (!e.res?.ok || !e.res.usage) continue;
    accrueUsage(meter, e.res.usage, e.res.model, e.label, e.op);
    counted++;
  }
  return counted > 0 ? meter : undefined;
}

/** Bezpieczny odczyt zużycia zapisanego w bazie (kolumna JSON) — uszkodzony wpis nie może wysypać strony. */
export function parseStoredUsage(raw: string | null | undefined): AiUsageInfo | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as AiUsageInfo;
    return parsed && Array.isArray(parsed.calls) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Z-130/Z-511: trwały budżet AI per użytkownik/plan (kontrola kosztów).
 *
 * Dzienne liczniki w tabeli `AiUsage` (wspólna baza → działa między instancjami,
 * w przeciwieństwie do liczników in-memory z `rateLimit.ts`, które zostają jako
 * szybki bezpiecznik anty-burst). Limity planów są w `lib/plans.ts` (Z-471).
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export type BudgetCheck = { ok: true } | { ok: false; message: string; retryAfterSec: number };

function secsToMidnightUtc(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

/** Sprawdza dzienny budżet (zapytania + tokeny) wg planu. */
export async function checkAiBudget(userId: string): Promise<BudgetCheck> {
  const [plan, usage] = await Promise.all([
    getActivePlan(userId),
    prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: todayUtc() } } }),
  ]);
  const suffix = plan.key === "free" ? " (plan darmowy — limit dzienny)" : "";
  if (usage && usage.requests >= plan.aiDailyRequests) {
    return { ok: false, retryAfterSec: secsToMidnightUtc(), message: `Wykorzystano dzienny limit zapytań do asystenta AI.${suffix} Spróbuj jutro.` };
  }
  if (usage && usage.tokens >= plan.aiDailyTokens) {
    return { ok: false, retryAfterSec: secsToMidnightUtc(), message: `Wykorzystano dzienny budżet AI.${suffix} Spróbuj jutro.` };
  }
  return { ok: true };
}

/** Dolicza jedno zapytanie + tokeny do dziennego licznika (po wykonaniu operacji). */
export async function recordAiUsage(userId: string, tokens: number): Promise<void> {
  const day = todayUtc();
  const t = Math.max(0, Math.round(tokens || 0));
  await prisma.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, requests: 1, tokens: t },
    update: { requests: { increment: 1 }, tokens: { increment: t } },
  });
}

/** Z-510: agregaty zużycia AI (ekonomika jednostkowa). */
export async function getAiUsageStats(days = 30): Promise<{
  totalRequests: number;
  totalTokens: number;
  activeUsers: number;
  perDay: { day: string; requests: number; tokens: number }[];
}> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await prisma.aiUsage.findMany({ where: { day: { gte: since } }, orderBy: { day: "asc" } });
  const perDayMap = new Map<string, { requests: number; tokens: number }>();
  const users = new Set<string>();
  let totalRequests = 0;
  let totalTokens = 0;
  for (const r of rows) {
    users.add(r.userId);
    totalRequests += r.requests;
    totalTokens += r.tokens;
    const d = perDayMap.get(r.day) ?? { requests: 0, tokens: 0 };
    d.requests += r.requests;
    d.tokens += r.tokens;
    perDayMap.set(r.day, d);
  }
  return {
    totalRequests,
    totalTokens,
    activeUsers: users.size,
    perDay: Array.from(perDayMap.entries()).map(([day, v]) => ({ day, requests: v.requests, tokens: v.tokens })),
  };
}

// ─── 002-ai-architecture: log per-wywołanie LLM + koszt + alert ──────────────

export const COST_ALERT_CONFIG_KEY = "ai_cost_daily_alert_usd";

export interface AiCallEntry {
  userId?: string | null;
  operationType: string; // dispatch | reasoning | vision | generation
  providerKind: string; // openai_compat | anthropic
  model: string;
  usage?: { prompt: number; completion: number; total: number; cacheRead?: number; cacheWrite?: number };
  latencyMs: number;
  ok: boolean;
  source?: string;
  status?: number; // status HTTP dostawcy (np. 429); dla diagnostyki
  errorText?: string; // treść błędu dostawcy (skrócona) dla wywołań nieudanych
  conversationId?: string | null; // powiązanie z rozmową asystenta
  attempts?: number; // liczba prób (retry na 429/5xx wliczone)
  effort?: string | null; // 033: poziom wysiłku FAKTYCZNIE użyty ("none" → zapisujemy null)
}

/**
 * Zapisuje jedno wywołanie LLM do `AiCall` (koszt SZACOWANY z cennika) i — jeśli
 * ustawiono próg — sprawdza dzienny alert kosztowy. Fire-and-forget: nie blokuje
 * odpowiedzi asystenta, błędy zapisu są łykane przez wołającego (`.catch`).
 */
export async function recordAiCall(entry: AiCallEntry): Promise<void> {
  const u = entry.usage;
  const costUsd = u
    ? estimateCostUsd(
        {
          promptTokens: u.prompt,
          completionTokens: u.completion,
          cacheReadTokens: u.cacheRead ?? 0,
          cacheWriteTokens: u.cacheWrite ?? 0,
        },
        entry.model
      )
    : 0;
  await prisma.aiCall.create({
    data: {
      userId: entry.userId ?? null,
      operationType: entry.operationType,
      providerKind: entry.providerKind,
      model: entry.model,
      promptTokens: u?.prompt ?? 0,
      completionTokens: u?.completion ?? 0,
      cacheReadTokens: u?.cacheRead ?? 0,
      cacheWriteTokens: u?.cacheWrite ?? 0,
      totalTokens: u?.total ?? 0,
      costUsd,
      latencyMs: Math.max(0, Math.round(entry.latencyMs || 0)),
      ok: entry.ok,
      status: entry.status ?? null,
      errorText: entry.errorText ? entry.errorText.slice(0, 500) : null,
      conversationId: entry.conversationId ?? null,
      attempts: Math.max(1, Math.round(entry.attempts ?? 1)),
      source: entry.source ?? null,
      effort: entry.effort && entry.effort !== "none" ? entry.effort : null,
    },
  });
  // Alert kosztowy — tylko gdy próg skonfigurowany (>0). Idempotentny per dzień.
  await maybeFireCostAlert().catch(() => {});
}

/** Suma szacowanego kosztu (USD) z `AiCall` za dany dzień UTC (domyślnie dziś). */
export async function getDailyCostUsd(day = todayUtc()): Promise<number> {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  const agg = await prisma.aiCall.aggregate({
    where: { createdAt: { gte: start, lt: end } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}

async function readCostThreshold(): Promise<number> {
  const row = await prisma.config.findUnique({ where: { key: COST_ALERT_CONFIG_KEY } });
  const n = row?.value ? Number(row.value) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Powiadamia adminów, gdy dzienny szacowany koszt przekroczy próg. Nie blokuje
// asystenta. dedupeKey per dzień → jedno powiadomienie na dobę.
async function maybeFireCostAlert(): Promise<void> {
  const threshold = await readCostThreshold();
  if (threshold <= 0) return;
  const day = todayUtc();
  const total = await getDailyCostUsd(day);
  if (total < threshold) return;
  const admins = await getAdminUserIds();
  // 029: dokładamy równowartość w PLN wg przelicznika z /admin/llm.
  const rate = await getUsdPlnRate();
  const totalStr = withPln(`$${total.toFixed(2)}`, total, rate);
  const thresholdStr = withPln(`$${threshold.toFixed(2)}`, threshold, rate);
  await Promise.all(
    admins.map((userId) =>
      notifyUser({
        userId,
        module: "admin",
        title: "Przekroczono dzienny próg kosztów AI",
        body: `Szacowany koszt AI na dziś (${day}) to ${totalStr} — próg ${thresholdStr}.`,
        href: "/admin/llm",
        dedupeKey: `ai-cost-alert-${day}`,
      })
    )
  );
}

// Użytkownicy z dostępem do panelu admina (rola przyznająca `module.admin`).
async function getAdminUserIds(): Promise<string[]> {
  const perm = await prisma.permission.findUnique({
    where: { slug: PERMISSIONS.ADMIN },
    select: { id: true },
  });
  if (!perm) return [];
  const adminRoles = (
    await prisma.rolePermission.findMany({ where: { permissionId: perm.id }, select: { role: true } })
  ).map((g) => g.role);
  if (adminRoles.length === 0) return [];
  const rows = await prisma.userRole.findMany({
    where: { role: { in: adminRoles } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.map((r) => r.userId);
}
