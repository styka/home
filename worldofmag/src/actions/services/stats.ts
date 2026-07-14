"use server";

// Z-213/361: akcje modułu Usługi — statystyki wykonawcy (M13).
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import type { ProviderStats } from "@/lib/services";

export async function getProviderStats(): Promise<ProviderStats | null> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({
    where: { userId: user.id },
    select: { id: true, ratingAvg: true, ratingCount: true },
  });
  if (!provider) return null;

  const [grouped, paid] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["status"],
      where: { providerId: provider.id },
      _count: { _all: true },
    }),
    prisma.servicePayment.aggregate({
      where: { status: "PAID", request: { providerId: provider.id } },
      _sum: { amount: true },
    }),
  ]);

  const countOf = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);
  const completed = countOf("COMPLETED");
  const cancelled = countOf("CANCELLED") + countOf("DECLINED");
  const active = countOf("REQUESTED") + countOf("ACCEPTED") + countOf("SCHEDULED") + countOf("IN_PROGRESS");
  const settled = total - active; // zlecenia rozstrzygnięte
  const conversionPct = settled > 0 ? Math.round((completed / settled) * 100) : 0;

  return {
    total, completed, active, cancelled, conversionPct,
    revenue: paid._sum.amount ?? 0,
    ratingAvg: provider.ratingAvg, ratingCount: provider.ratingCount,
  };
}
