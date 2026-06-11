// W4: automatyczne księgowanie wydatków z innych modułów (Flota…) do Portfela.
// Plik NIE jest "use server" — to wewnętrzny helper wołany przez Server Actions
// (np. flota.ts), nie eksponowany do klienta. Idempotentny po (sourceModule, sourceId).

import { prisma } from "@/lib/prisma";

export type AutoExpenseInput = {
  module: string; // "flota" itd.
  sourceId: string; // id rekordu źródłowego (FuelLog/ServiceRecord)
  amount: number; // kwota (>0)
  category: string;
  note?: string | null;
  date?: Date | null;
  /** Pomija globalny przełącznik auto-księgowania (jawna akcja użytkownika), ale nadal wymaga konta. */
  force?: boolean;
};

/**
 * Księguje (lub aktualizuje) auto-wydatek na domyślnym koncie użytkownika,
 * o ile auto-księgowanie jest włączone. Bezpieczne do wołania zawsze —
 * gdy wyłączone / brak konta / kwota zerowa, po prostu nic nie robi.
 */
export async function bookAutoExpense(userId: string, opts: AutoExpenseInput): Promise<void> {
  const amount = Math.abs(opts.amount);
  if (!amount || isNaN(amount)) return;

  const settings = await prisma.financeSettings.findUnique({ where: { userId } });
  if (!settings?.autoExpenseElementId) return;
  if (!settings.autoExpenseEnabled && !opts.force) return;

  const el = await prisma.walletElement.findUnique({ where: { id: settings.autoExpenseElementId } });
  // Tylko prywatne, aktywne konto użytkownika (nie księgujemy na cudze/zespołowe automatycznie).
  if (!el || el.ownerId !== userId || el.archived) return;

  const existing = await prisma.walletEntry.findFirst({
    where: { sourceModule: opts.module, sourceId: opts.sourceId },
  });

  if (existing) {
    // Aktualizacja istniejącego auto-wpisu (np. zmieniona kwota) — koryguj saldo o różnicę.
    const newDelta = -amount;
    const diff = newDelta - existing.delta;
    const balanceAfter = el.balance + diff;
    await prisma.$transaction([
      prisma.walletEntry.update({
        where: { id: existing.id },
        data: { delta: newDelta, balanceAfter, category: opts.category, note: opts.note ?? existing.note, date: opts.date ?? existing.date },
      }),
      prisma.walletElement.update({ where: { id: el.id }, data: { balance: balanceAfter } }),
    ]);
    return;
  }

  const balanceAfter = el.balance - amount;
  await prisma.$transaction([
    prisma.walletEntry.create({
      data: {
        elementId: el.id,
        date: opts.date ?? new Date(),
        balanceAfter,
        delta: -amount,
        kind: "expense",
        category: opts.category,
        note: opts.note ?? null,
        sourceModule: opts.module,
        sourceId: opts.sourceId,
      },
    }),
    prisma.walletElement.update({ where: { id: el.id }, data: { balance: balanceAfter } }),
  ]);
}

/** Usuwa auto-wpis powiązany ze źródłem (przy kasowaniu rekordu) i odwraca saldo. */
export async function removeAutoExpense(module: string, sourceId: string): Promise<void> {
  const entry = await prisma.walletEntry.findFirst({ where: { sourceModule: module, sourceId } });
  if (!entry) return;
  const el = await prisma.walletElement.findUnique({ where: { id: entry.elementId } });
  await prisma.$transaction([
    prisma.walletEntry.delete({ where: { id: entry.id } }),
    ...(el ? [prisma.walletElement.update({ where: { id: el.id }, data: { balance: el.balance - entry.delta } })] : []),
  ]);
}
