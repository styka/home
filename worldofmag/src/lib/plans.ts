import { prisma } from "@/lib/prisma";

/**
 * Z-471 (monetyzacja): definicje planów handlowych w kodzie (rzadko się zmieniają).
 * Tabela `Subscription` trzyma tylko przypisanie + status; limity/funkcje tutaj.
 * Linia podziału funkcji free/premium (Z-470) to decyzja właściciela — poniżej
 * rozsądny domyślny podział, łatwy do zmiany.
 */
export type PlanKey = "free" | "premium";

export interface PlanDef {
  key: PlanKey;
  name: string;
  aiDailyRequests: number;
  aiDailyTokens: number;
  /** Klucze funkcji premium, których plan udostępnia (bramkowanie przez hasFeature). */
  features: string[];
}

export const PLANS: Record<PlanKey, PlanDef> = {
  free: { key: "free", name: "Darmowy", aiDailyRequests: 100, aiDailyTokens: 200_000, features: [] },
  premium: { key: "premium", name: "Premium", aiDailyRequests: 1000, aiDailyTokens: 2_000_000, features: ["pro_modules", "priority_ai", "ai_cache"] },
};

export function planDef(key: string | null | undefined): PlanDef {
  return key && key in PLANS ? PLANS[key as PlanKey] : PLANS.free;
}

/**
 * Aktywny plan użytkownika: z `Subscription` (gdy status="active"); perk ADMIN→premium
 * do czasu wdrożenia bramki płatności (Z-473). Brak subskrypcji = `free`.
 */
export async function getActivePlan(userId: string): Promise<PlanDef> {
  const [sub, admin] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId }, select: { planKey: true, status: true } }),
    prisma.userRole.findFirst({ where: { userId, role: "ADMIN" }, select: { userId: true } }),
  ]);
  if (sub && sub.status === "active" && sub.planKey in PLANS) return PLANS[sub.planKey as PlanKey];
  if (admin) return PLANS.premium;
  return PLANS.free;
}

/** Z-471: bramkowanie funkcji premium. */
export async function hasFeature(userId: string, feature: string): Promise<boolean> {
  const plan = await getActivePlan(userId);
  return plan.features.includes(feature);
}
