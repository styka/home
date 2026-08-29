// W4: automatyczne księgowanie wydatków z innych modułów (Flota…) do Portfela.
// Plik NIE jest "use server" — to wewnętrzny helper wołany przez Server Actions
// (np. flota.ts), nie eksponowany do klienta. Idempotentny po (sourceModule, sourceId).

import { czyMojRekord } from "@/platform/workspaces/zapis"
import { prisma } from "@/platform/db/prisma";

export type AutoExpenseInput = {
  module: string; // "flota" itd.
  sourceId: string; // id rekordu źródłowego (FuelLog/ServiceRecord)
  amount: number; // kwota (>0)
  category: string;
  note?: string | null;
  date?: Date | null;
  /** Pomija globalny przełącznik auto-księgowania (jawna akcja użytkownika), ale nadal wymaga konta. */
  force?: boolean;
  /** 115: kierunek wpisu. Domyślnie wydatek; "income" księguje PRZYCHÓD (dodatnia delta) —
   *  np. sprzedaż zwierzęcia. Ten sam mechanizm idempotencji po (sourceModule, sourceId). */
  kind?: "expense" | "income";
};

/**
 * 115: wynik księgowania. Do tej pory funkcja zwracała `void` i przy braku konfiguracji
 * po cichu nic nie robiła — dla automatów w tle to poprawne, ale JAWNY przycisk
 * („Zaksięguj w Portfelu"), po którym nic się nie dzieje, wygląda jak awaria.
 * Nowi konsumenci czytają wynik i mówią użytkownikowi, czego brakuje; starzy dalej
 * mogą go ignorować (zmiana zgodna wstecz).
 */
export type WynikKsiegowania = {
  zaksiegowano: boolean;
  powod?: "brak-konta" | "kwota-zero";
};

/**
 * Księguje (lub aktualizuje) auto-wpis na domyślnym koncie użytkownika,
 * o ile auto-księgowanie jest włączone. Bezpieczne do wołania zawsze —
 * gdy wyłączone / brak konta / kwota zerowa, po prostu nic nie robi
 * (a wynik mówi dlaczego).
 */
export async function bookAutoExpense(userId: string, opts: AutoExpenseInput): Promise<WynikKsiegowania> {
  const amount = Math.abs(opts.amount);
  if (!amount || isNaN(amount)) return { zaksiegowano: false, powod: "kwota-zero" };

  const settings = await prisma.financeSettings.findUnique({ where: { userId } });
  if (!settings?.autoExpenseElementId) return { zaksiegowano: false, powod: "brak-konta" };
  if (!settings.autoExpenseEnabled && !opts.force) return { zaksiegowano: false, powod: "brak-konta" };

  const el = await prisma.walletElement.findUnique({ where: { id: settings.autoExpenseElementId } });
  // Tylko prywatne, aktywne konto użytkownika (nie księgujemy na cudze/zespołowe automatycznie).
  if (!el || !(await czyMojRekord(el, userId)) || el.archived) return { zaksiegowano: false, powod: "brak-konta" };

  // Kierunek: wydatek = ujemna delta, przychód = dodatnia. Znak siedzi w JEDNYM miejscu.
  const kind = opts.kind === "income" ? "income" : "expense";
  const znak = kind === "income" ? 1 : -1;

  const existing = await prisma.walletEntry.findFirst({
    where: { sourceModule: opts.module, sourceId: opts.sourceId },
  });

  if (existing) {
    // Aktualizacja istniejącego auto-wpisu (np. zmieniona kwota) — koryguj saldo o różnicę.
    const newDelta = znak * amount;
    const diff = newDelta - existing.delta;
    const balanceAfter = el.balance + diff;
    await prisma.$transaction([
      prisma.walletEntry.update({
        where: { id: existing.id },
        data: { delta: newDelta, balanceAfter, kind, category: opts.category, note: opts.note ?? existing.note, date: opts.date ?? existing.date },
      }),
      prisma.walletElement.update({ where: { id: el.id }, data: { balance: balanceAfter } }),
    ]);
    return { zaksiegowano: true };
  }

  const balanceAfter = el.balance + znak * amount;
  await prisma.$transaction([
    prisma.walletEntry.create({
      data: {
        elementId: el.id,
        date: opts.date ?? new Date(),
        balanceAfter,
        delta: znak * amount,
        kind,
        category: opts.category,
        note: opts.note ?? null,
        sourceModule: opts.module,
        sourceId: opts.sourceId,
      },
    }),
    prisma.walletElement.update({ where: { id: el.id }, data: { balance: balanceAfter } }),
  ]);
  return { zaksiegowano: true };
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
