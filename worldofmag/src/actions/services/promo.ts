"use server";

// Z-213/361: akcje modułu Usługi — kody rabatowe (M16, wyodrębnione z actions/services.ts).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { requireMyProvider } from "@/lib/services/helpers";
import { loadRequestAccess } from "@/lib/services/access";
import type { PromoKind, ServicePromoCodeDTO } from "@/lib/services";

export async function getMyPromoCodes(): Promise<ServicePromoCodeDTO[]> {
  const user = await requireAuth();
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!provider) return [];
  const rows = await prisma.servicePromoCode.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "desc" } });
  return rows.map((c) => ({
    id: c.id, code: c.code, kind: c.kind as PromoKind, value: c.value,
    minAmount: c.minAmount, maxUses: c.maxUses, usedCount: c.usedCount, active: c.active,
    expiresAt: c.expiresAt?.toISOString() ?? null,
  }));
}

export async function createPromoCode(data: {
  code: string;
  kind: PromoKind;
  value: number; // percent (1-100) lub PLN (przeliczane na grosze)
  minAmount?: number | null; // PLN
  maxUses?: number | null;
  expiresAt?: string | null;
}): Promise<void> {
  const user = await requireAuth();
  const provider = await requireMyProvider(user.id);
  const code = data.code.trim().toUpperCase();
  if (!code || code.length > 32) throw new Error("Podaj kod (max 32 znaki)");
  const kind: PromoKind = data.kind === "amount" ? "amount" : "percent";
  let value = Math.round(data.value);
  if (kind === "percent") {
    if (value < 1 || value > 100) throw new Error("Procent musi być w zakresie 1–100");
  } else {
    value = Math.round(data.value * 100); // PLN → grosze
    if (value <= 0) throw new Error("Kwota rabatu musi być > 0");
  }
  await prisma.servicePromoCode.create({
    data: {
      providerId: provider.id,
      code,
      kind,
      value,
      minAmount: data.minAmount != null ? Math.round(data.minAmount * 100) : null,
      maxUses: data.maxUses != null && data.maxUses > 0 ? Math.round(data.maxUses) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  }).catch(() => { throw new Error("Taki kod już istnieje"); });
  revalidatePath("/services/provider");
}

export async function togglePromoCode(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireMyProvider(user.id);
  const code = await prisma.servicePromoCode.findFirst({ where: { id, providerId: provider.id } });
  if (!code) throw new Error("Kod nie istnieje");
  await prisma.servicePromoCode.update({ where: { id }, data: { active: !code.active } });
  revalidatePath("/services/provider");
}

export async function deletePromoCode(id: string): Promise<void> {
  const user = await requireAuth();
  const provider = await requireMyProvider(user.id);
  await prisma.servicePromoCode.deleteMany({ where: { id, providerId: provider.id } });
  revalidatePath("/services/provider");
}

/** Klient/wykonawca stosuje kod rabatowy do płatności zlecenia (M16). */
export async function applyPromoCode(requestId: string, rawCode: string): Promise<{ discount: number }> {
  const user = await requireAuth();
  const { req } = await loadRequestAccess(requestId, user.id);
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error("Podaj kod rabatowy");

  const payment = await prisma.servicePayment.findUnique({ where: { requestId } });
  if (!payment) throw new Error("Najpierw wykonawca musi ustalić kwotę");
  if (payment.status === "PAID") throw new Error("Płatność jest już rozliczona");

  const promo = await prisma.servicePromoCode.findUnique({
    where: { providerId_code: { providerId: req.providerId, code } },
  });
  if (!promo || !promo.active) throw new Error("Nieprawidłowy lub nieaktywny kod");
  if (promo.expiresAt && promo.expiresAt < new Date()) throw new Error("Kod wygasł");
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) throw new Error("Kod osiągnął limit użyć");
  if (promo.minAmount != null && payment.amount < promo.minAmount) {
    throw new Error(`Kod wymaga kwoty min. ${(promo.minAmount / 100).toFixed(2)} ${payment.currency}`);
  }

  let discount = promo.kind === "percent"
    ? Math.floor((payment.amount * promo.value) / 100)
    : promo.value;
  discount = Math.min(discount, payment.amount); // rabat nie większy niż kwota

  // Zmiana kodu na inny: cofnij zużycie poprzedniego.
  if (payment.promoCode && payment.promoCode !== code) {
    await prisma.servicePromoCode.updateMany({
      where: { providerId: req.providerId, code: payment.promoCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
  await prisma.$transaction([
    prisma.servicePayment.update({ where: { requestId }, data: { promoCode: code, discount } }),
    ...(payment.promoCode === code ? [] : [prisma.servicePromoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } })]),
  ]);
  revalidatePath("/services/requests");
  revalidatePath("/services/provider");
  return { discount };
}

/** Usuwa zastosowany kod rabatowy z płatności. */
export async function clearPromoCode(requestId: string): Promise<void> {
  const user = await requireAuth();
  const { req } = await loadRequestAccess(requestId, user.id);
  const payment = await prisma.servicePayment.findUnique({ where: { requestId } });
  if (!payment || !payment.promoCode) return;
  if (payment.status === "PAID") throw new Error("Płatność jest już rozliczona");
  await prisma.$transaction([
    prisma.servicePayment.update({ where: { requestId }, data: { promoCode: null, discount: 0 } }),
    prisma.servicePromoCode.updateMany({
      where: { providerId: req.providerId, code: payment.promoCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    }),
  ]);
  revalidatePath("/services/requests");
}
