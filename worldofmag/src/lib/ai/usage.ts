import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/plans";

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
