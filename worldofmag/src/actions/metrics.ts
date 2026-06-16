"use server";

import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getConfigValue } from "@/actions/config";
import { getAiUsageStats } from "@/lib/ai/usage";

/**
 * Z-510 — ekonomika jednostkowa. Część mierzalna liczymy z realnych danych
 * (zużycie AI z `AiUsage` × cena tokenów); część przychodowa (ARPU/CAC/LTV) wymaga
 * danych z warstwy płatności/marketingu, których jeszcze nie ma — zwracamy je jako
 * `null` z jawną adnotacją (input właściciela), zamiast zmyślać.
 *
 * Cena tokenów: Config `ai_cost_per_1m_tokens` (USD / 1M tokenów), domyślnie 0.30
 * (rząd wielkości Groq). Zmienisz ją w /admin/config.
 */
export interface UnitEconomics {
  windowDays: number;
  registeredUsers: number;
  aiActiveUsers: number; // MAU (proxy: użytkownicy z aktywnością AI w oknie)
  aiRequests: number;
  aiTokens: number;
  pricePer1mTokensUsd: number;
  estAiCostUsd: number;
  estAiCostPerActiveUserUsd: number | null;
  perDay: { day: string; requests: number; tokens: number }[];
  /** Metryki przychodowe — wymagają danych z billingu/marketingu (brak → null). */
  revenue: {
    arpuUsd: number | null;
    cacUsd: number | null;
    ltvUsd: number | null;
    note: string;
  };
}

export async function getUnitEconomics(windowDays = 30): Promise<UnitEconomics> {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");

  const [stats, registeredUsers, priceRaw] = await Promise.all([
    getAiUsageStats(windowDays),
    prisma.user.count(),
    getConfigValue("ai_cost_per_1m_tokens"),
  ]);

  const price = Number(priceRaw);
  const pricePer1mTokensUsd = Number.isFinite(price) && price > 0 ? price : 0.3;
  const estAiCostUsd = (stats.totalTokens / 1_000_000) * pricePer1mTokensUsd;

  return {
    windowDays,
    registeredUsers,
    aiActiveUsers: stats.activeUsers,
    aiRequests: stats.totalRequests,
    aiTokens: stats.totalTokens,
    pricePer1mTokensUsd,
    estAiCostUsd,
    estAiCostPerActiveUserUsd: stats.activeUsers > 0 ? estAiCostUsd / stats.activeUsers : null,
    perDay: stats.perDay,
    revenue: {
      arpuUsd: null,
      cacUsd: null,
      ltvUsd: null,
      note: "ARPU/CAC/LTV wymagają danych z warstwy płatności i marketingu (jeszcze nie wdrożone — patrz monetyzacja P1). Po wpięciu billingu policzymy je z realnych przychodów i kosztów pozyskania.",
    },
  };
}
