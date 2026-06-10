// W5: przeliczanie majątku na walutę sprawozdawczą. Helper server-side (nie "use server").
// rates[c] = ile jednostek baseCurrency kosztuje 1 jednostka waluty c (kurs „1 c = rate × base").

import { prisma } from "@/lib/prisma";

export type RateInfo = { base: string; rates: Record<string, number> };

export async function loadRates(userId: string): Promise<RateInfo> {
  const settings = await prisma.financeSettings.findUnique({ where: { userId }, select: { baseCurrency: true } });
  const base = (settings?.baseCurrency ?? "PLN").toUpperCase();
  const rows = await prisma.exchangeRate.findMany({ where: { userId }, select: { currency: true, rate: true } });
  const rates: Record<string, number> = {};
  for (const r of rows) rates[r.currency.toUpperCase()] = r.rate;
  rates[base] = 1;
  return { base, rates };
}

/** Przelicza kwotę na walutę bazową. converted=false, gdy brak kursu (liczone 1:1, do oznaczenia). */
export function toBase(amount: number, currency: string | null | undefined, info: RateInfo): { value: number; converted: boolean } {
  const c = (currency || info.base).toUpperCase();
  if (c === info.base) return { value: amount, converted: true };
  const r = info.rates[c];
  if (!r || r <= 0) return { value: amount, converted: false };
  return { value: amount * r, converted: true };
}
