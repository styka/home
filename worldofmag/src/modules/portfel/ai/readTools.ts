import { getBudgetsWithSpending, getFinanceGoals, getMonthlyReport, getWalletOverview } from "../contract";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_wallet: args {} → [{ id, name, kind, balance }]. Elementy portfela (konta/oszczędności/długi) z saldem w PLN.",
  "- list_budgets: args {} → { periodLabel, budgets:[{ id, category, limitAmount, spent, currency }] }. Budżety miesięczne z wydatkowaniem.",
  "- list_goals: args {} → [{ id, name, targetAmount, currentAmount, currency, deadline }]. Cele oszczędnościowe.",
  "- get_wallet_overview: args {} → { totalNet, currency, monthlyRate, projection6m }. Podsumowanie majątku (suma netto, tempo zmian, prognoza 6 mies.).",
  "- get_monthly_report: args { monthOffset? } → { income, expense, balance, byCategory:[…] }. Miesięczny raport finansowy (0=bieżący, -1=poprzedni).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_wallet: async (args, userId) => {
      // Z-055: dane finansowe (salda/długi) trafiają do AI tylko, gdy użytkownik
      // nie wyłączył dostępu (opt-out, domyślnie włączony — brak rekordu = dozwolone).
      const fs = await prisma.financeSettings.findUnique({ where: { userId }, select: { aiAccessEnabled: true } });
      if (fs && fs.aiAccessEnabled === false) {
        return [{ note: "Dostęp AI do danych finansowych jest wyłączony. Włącz go w Portfel → Ustawienia, jeśli chcesz, by asystent z nich korzystał." }];
      }
      const elements = await prisma.walletElement.findMany({
        where: { archived: false, ...(await ownerScope(userId)) },
        select: { id: true, name: true, kind: true, balance: true },
        orderBy: { createdAt: "asc" },
        take: HARD_MAX,
      });
      return elements;
  },
  list_budgets: async (args, userId) => {
      const { budgets, periodLabel } = await getBudgetsWithSpending();
      return { periodLabel, budgets: budgets.map((b) => ({ id: b.id, category: b.category, limitAmount: b.limitAmount, spent: b.spent, currency: b.currency })) };
  },
  list_goals: async (args, userId) => {
      const goals = await getFinanceGoals();
      return goals.map((g) => ({
        id: g.id, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
        currency: g.currency, deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null,
      }));
  },
  get_wallet_overview: async (args, userId) => {
      const o = await getWalletOverview();
      return { totalNet: o.totalNet, currency: o.currency, monthlyRate: o.monthlyRate, projection6m: o.projection6m };
  },
  get_monthly_report: async (args, userId) => {
      const offset = typeof args.monthOffset === "number" ? args.monthOffset : 0;
      return getMonthlyReport(offset);
  },
};
