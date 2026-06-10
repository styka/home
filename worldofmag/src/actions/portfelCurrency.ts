"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";

export type ExchangeRateDTO = { currency: string; rate: number; source: string; updatedAt: string };

export async function getCurrencySettings(): Promise<{ baseCurrency: string; rates: ExchangeRateDTO[] }> {
  const user = await requireAuth();
  const [settings, rows] = await Promise.all([
    prisma.financeSettings.findUnique({ where: { userId: user.id }, select: { baseCurrency: true } }),
    prisma.exchangeRate.findMany({ where: { userId: user.id }, orderBy: { currency: "asc" } }),
  ]);
  return {
    baseCurrency: settings?.baseCurrency ?? "PLN",
    rates: rows.map((r) => ({ currency: r.currency, rate: r.rate, source: r.source, updatedAt: r.updatedAt.toISOString() })),
  };
}

function normCurrency(c: string): string {
  return c.trim().toUpperCase().slice(0, 8);
}

export async function setBaseCurrency(currency: string): Promise<void> {
  const user = await requireAuth();
  const base = normCurrency(currency);
  if (!base) throw new Error("Podaj walutę");
  await prisma.financeSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, baseCurrency: base },
    update: { baseCurrency: base },
  });
  // Kurs waluty bazowej do siebie jest zawsze 1 — usuń ewentualny zbędny wpis.
  await prisma.exchangeRate.deleteMany({ where: { userId: user.id, currency: base } });
  revalidatePath("/portfel");
  revalidatePath("/portfel/ustawienia");
}

export async function setExchangeRate(currency: string, rate: number): Promise<void> {
  const user = await requireAuth();
  const c = normCurrency(currency);
  if (!c) throw new Error("Podaj walutę");
  const r = Math.abs(rate);
  if (!r || isNaN(r)) throw new Error("Podaj kurs większy od zera");
  await prisma.exchangeRate.upsert({
    where: { userId_currency: { userId: user.id, currency: c } },
    create: { userId: user.id, currency: c, rate: r, source: "manual" },
    update: { rate: r, source: "manual" },
  });
  revalidatePath("/portfel");
  revalidatePath("/portfel/ustawienia");
}

export async function deleteExchangeRate(currency: string): Promise<void> {
  const user = await requireAuth();
  await prisma.exchangeRate.deleteMany({ where: { userId: user.id, currency: normCurrency(currency) } });
  revalidatePath("/portfel");
  revalidatePath("/portfel/ustawienia");
}

type NbpTable = { rates: { currency: string; code: string; mid: number }[] }[];

/**
 * Najlepszy-wysiłek odświeżenie kursów z API NBP (tabela A). Działa na produkcji
 * (Render ma otwartą sieć); w środowiskach z blokadą sieci rzuca czytelny błąd.
 * Zwraca liczbę zaktualizowanych kursów.
 */
export async function refreshRatesFromNBP(): Promise<{ updated: number }> {
  const user = await requireAuth();
  const settings = await prisma.financeSettings.findUnique({ where: { userId: user.id }, select: { baseCurrency: true } });
  const base = (settings?.baseCurrency ?? "PLN").toUpperCase();

  let data: NbpTable;
  try {
    const res = await fetch("https://api.nbp.pl/api/exchangerates/tables/A?format=json", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`NBP HTTP ${res.status}`);
    data = (await res.json()) as NbpTable;
  } catch {
    throw new Error("Nie udało się pobrać kursów z NBP (brak dostępu do sieci?). Wprowadź kursy ręcznie.");
  }

  const rows = data?.[0]?.rates ?? [];
  if (rows.length === 0) throw new Error("NBP nie zwróciło kursów");

  // mid = ile PLN za 1 jednostkę waluty. Przelicz na bazę: rate_base = mid_code / mid_base.
  const midPlnPer: Record<string, number> = { PLN: 1 };
  for (const r of rows) midPlnPer[r.code.toUpperCase()] = r.mid;
  const midBase = midPlnPer[base];
  if (!midBase) throw new Error(`NBP nie ma kursu dla waluty bazowej ${base}`);

  let updated = 0;
  for (const r of rows) {
    const code = r.code.toUpperCase();
    if (code === base) continue;
    const rateInBase = r.mid / midBase; // 1 code = rateInBase × base
    await prisma.exchangeRate.upsert({
      where: { userId_currency: { userId: user.id, currency: code } },
      create: { userId: user.id, currency: code, rate: rateInBase, source: "nbp" },
      update: { rate: rateInBase, source: "nbp" },
    });
    updated++;
  }
  // Gdy baza ≠ PLN, dodaj też kurs PLN względem bazy.
  if (base !== "PLN") {
    const plnInBase = 1 / midBase;
    await prisma.exchangeRate.upsert({
      where: { userId_currency: { userId: user.id, currency: "PLN" } },
      create: { userId: user.id, currency: "PLN", rate: plnInBase, source: "nbp" },
      update: { rate: plnInBase, source: "nbp" },
    });
    updated++;
  }

  revalidatePath("/portfel");
  revalidatePath("/portfel/ustawienia");
  return { updated };
}
