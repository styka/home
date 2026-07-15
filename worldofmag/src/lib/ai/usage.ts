import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/plans";
import { estimateCostUsd } from "@/lib/llm/pricing";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyUser } from "@/actions/notifications";

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

const COST_ALERT_CONFIG_KEY = "ai_cost_daily_alert_usd";

export interface AiCallEntry {
  userId?: string | null;
  operationType: string; // dispatch | reasoning | vision | generation
  providerKind: string; // openai_compat | anthropic
  model: string;
  usage?: { prompt: number; completion: number; total: number; cacheRead?: number; cacheWrite?: number };
  latencyMs: number;
  ok: boolean;
  source?: string;
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
      source: entry.source ?? null,
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
  await Promise.all(
    admins.map((userId) =>
      notifyUser({
        userId,
        module: "admin",
        title: "Przekroczono dzienny próg kosztów AI",
        body: `Szacowany koszt AI na dziś (${day}) to $${total.toFixed(2)} — próg $${threshold.toFixed(2)}.`,
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
