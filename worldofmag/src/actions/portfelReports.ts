"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, getAccessibleTeamIds } from "@/lib/server-utils";

export type CategorySlice = { category: string; amount: number; pct: number };

export type MonthlyReport = {
  monthOffset: number;
  label: string; // np. "czerwiec 2026"
  income: number;
  expense: number;
  net: number;
  currency: string;
  byCategory: CategorySlice[]; // wydatki per kategoria, malejąco
  prevExpense: number | null; // wydatki poprzedniego miesiąca (do porównania)
  expenseDeltaPct: number | null; // zmiana wydatków vs poprzedni miesiąc [%]
  entryCount: number;
  hasOlder: boolean; // czy istnieją wpisy starsze niż ten miesiąc (do nawigacji wstecz)
};

function monthRange(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** Raport miesięczny „gdzie poszły pieniądze". monthOffset 0 = bieżący, 1 = poprzedni, … */
export async function getMonthlyReport(monthOffset = 0): Promise<MonthlyReport> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "portfel");

  const elements = await prisma.walletElement.findMany({
    where: { OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] },
    select: { id: true, currency: true },
  });
  const elementIds = elements.map((e) => e.id);
  const currency = elements[0]?.currency ?? "PLN";

  const { start, end } = monthRange(monthOffset);
  const label = start.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  if (elementIds.length === 0) {
    return { monthOffset, label, income: 0, expense: 0, net: 0, currency, byCategory: [], prevExpense: null, expenseDeltaPct: null, entryCount: 0, hasOlder: false };
  }

  const entries = await prisma.walletEntry.findMany({
    where: { elementId: { in: elementIds }, kind: { in: ["income", "expense"] }, date: { gte: start, lt: end } },
    select: { kind: true, delta: true, category: true },
  });

  let income = 0;
  let expense = 0;
  const catMap = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === "income") {
      income += Math.abs(e.delta);
    } else {
      const amt = Math.abs(e.delta);
      expense += amt;
      const cat = (e.category ?? "").trim() || "Bez kategorii";
      catMap.set(cat, (catMap.get(cat) ?? 0) + amt);
    }
  }

  const byCategory: CategorySlice[] = Array.from(catMap.entries())
    .map(([category, amount]) => ({ category, amount, pct: expense > 0 ? Math.round((amount / expense) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Poprzedni miesiąc — tylko suma wydatków do porównania.
  const prev = monthRange(monthOffset + 1);
  const prevExpenseEntries = await prisma.walletEntry.findMany({
    where: { elementId: { in: elementIds }, kind: "expense", date: { gte: prev.start, lt: prev.end } },
    select: { delta: true },
  });
  const prevExpense = prevExpenseEntries.length
    ? prevExpenseEntries.reduce((s, e) => s + Math.abs(e.delta), 0)
    : null;
  const expenseDeltaPct = prevExpense && prevExpense > 0
    ? Math.round(((expense - prevExpense) / prevExpense) * 100)
    : null;

  // Czy istnieją wpisy starsze niż początek bieżąco wyświetlanego miesiąca?
  const older = await prisma.walletEntry.findFirst({
    where: { elementId: { in: elementIds }, kind: { in: ["income", "expense"] }, date: { lt: start } },
    select: { id: true },
  });

  return {
    monthOffset, label, income, expense, net: income - expense, currency,
    byCategory, prevExpense, expenseDeltaPct, entryCount: entries.length, hasOlder: !!older,
  };
}
