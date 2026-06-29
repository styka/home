"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds, getAccessibleTeamIds } from "@/lib/server-utils";
import { trackActivity } from "@/actions/activity";
import type { Budget, FinanceGoal } from "@prisma/client";

async function scope(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return { teamIds, where: { OR: [{ ownerId: userId }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] } };
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

// ─── Budżety ─────────────────────────────────────────────────────────────────

export type BudgetWithSpending = Budget & { spent: number; remaining: number; pct: number };

/** Budżety + wydatki bieżącego miesiąca w danej kategorii (z wpisów typu expense). */
export async function getBudgetsWithSpending(): Promise<{ budgets: BudgetWithSpending[]; periodLabel: string }> {
  const user = await requireAuth();
  const { teamIds, where } = await scope(user.id);

  const budgets = await prisma.budget.findMany({ where, orderBy: { createdAt: "asc" } });
  if (budgets.length === 0) {
    return { budgets: [], periodLabel: monthLabel() };
  }

  // Wydatki tego miesiąca z elementów portfela użytkownika/zespołów, pogrupowane po kategorii.
  const elements = await prisma.walletElement.findMany({
    where: { OR: [{ ownerId: user.id }, ...(teamIds.length ? [{ ownerTeamId: { in: teamIds } }] : [])] },
    select: { id: true },
  });
  const elementIds = elements.map((e) => e.id);

  const entries = elementIds.length
    ? await prisma.walletEntry.findMany({
        where: { elementId: { in: elementIds }, kind: "expense", date: { gte: startOfMonth() } },
        select: { category: true, delta: true },
      })
    : [];

  const spentByCat = new Map<string, number>();
  for (const e of entries) {
    const cat = (e.category ?? "").trim().toLowerCase();
    if (!cat) continue;
    spentByCat.set(cat, (spentByCat.get(cat) ?? 0) + Math.abs(e.delta));
  }

  const withSpending = budgets.map((b) => {
    const spent = spentByCat.get(b.category.trim().toLowerCase()) ?? 0;
    const remaining = b.limitAmount - spent;
    const pct = b.limitAmount > 0 ? Math.min(999, Math.round((spent / b.limitAmount) * 100)) : 0;
    return { ...b, spent, remaining, pct };
  });

  return { budgets: withSpending, periodLabel: monthLabel() };
}

function monthLabel(d = new Date()): string {
  return d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

export async function createBudget(data: {
  category: string;
  limitAmount: number;
  currency?: string;
  note?: string | null;
  ownerTeamId?: string | null;
}): Promise<Budget> {
  const user = await requireAuth();
  const category = data.category.trim();
  if (!category) throw new Error("Podaj kategorię");
  const limitAmount = Math.abs(data.limitAmount);
  if (!limitAmount || isNaN(limitAmount)) throw new Error("Podaj limit większy od zera");

  let ownerTeamId: string | null = null;
  if (data.ownerTeamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "portfel");
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
    ownerTeamId = data.ownerTeamId;
  }

  const budget = await prisma.budget.create({
    data: {
      category,
      limitAmount,
      currency: data.currency?.trim() || "PLN",
      note: data.note?.trim() || null,
      ownerId: ownerTeamId ? null : user.id,
      ownerTeamId,
    },
  });
  void trackActivity("portfel", "create_budget", { category, limitAmount });
  revalidatePath("/portfel/budzety");
  return budget;
}

export async function updateBudget(
  id: string,
  patch: Partial<{ category: string; limitAmount: number; note: string | null }>,
): Promise<void> {
  const user = await requireAuth();
  await assertBudgetAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.category !== undefined) {
    const c = patch.category.trim();
    if (!c) throw new Error("Podaj kategorię");
    data.category = c;
  }
  if (patch.limitAmount !== undefined) {
    const l = Math.abs(patch.limitAmount);
    if (!l || isNaN(l)) throw new Error("Podaj limit większy od zera");
    data.limitAmount = l;
  }
  if (patch.note !== undefined) data.note = patch.note?.trim() || null;
  await prisma.budget.update({ where: { id }, data });
  revalidatePath("/portfel/budzety");
}

export async function deleteBudget(id: string): Promise<void> {
  const user = await requireAuth();
  await assertBudgetAccess(id, user.id);
  await prisma.budget.delete({ where: { id } });
  revalidatePath("/portfel/budzety");
}

async function assertBudgetAccess(id: string, userId: string): Promise<void> {
  const b = await prisma.budget.findUnique({ where: { id }, select: { ownerId: true, ownerTeamId: true } });
  if (!b) throw new Error("Budżet nie istnieje");
  if (b.ownerId === userId) return;
  if (b.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (teamIds.includes(b.ownerTeamId)) return;
  }
  throw new Error("Brak dostępu do budżetu");
}

// ─── Cele oszczędnościowe ────────────────────────────────────────────────────

export async function getFinanceGoals(): Promise<FinanceGoal[]> {
  const user = await requireAuth();
  const { where } = await scope(user.id);
  return prisma.financeGoal.findMany({ where, orderBy: [{ achievedAt: "asc" }, { createdAt: "asc" }] });
}

export async function createGoal(data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  deadline?: Date | string | null;
  note?: string | null;
  ownerTeamId?: string | null;
}): Promise<FinanceGoal> {
  const user = await requireAuth();
  const name = data.name.trim();
  if (!name) throw new Error("Podaj nazwę celu");
  const targetAmount = Math.abs(data.targetAmount);
  if (!targetAmount || isNaN(targetAmount)) throw new Error("Podaj kwotę docelową większą od zera");

  let ownerTeamId: string | null = null;
  if (data.ownerTeamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "portfel");
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Brak dostępu do zespołu");
    ownerTeamId = data.ownerTeamId;
  }

  const current = Math.max(0, data.currentAmount ?? 0);
  const goal = await prisma.financeGoal.create({
    data: {
      name,
      targetAmount,
      currentAmount: current,
      currency: data.currency?.trim() || "PLN",
      deadline: data.deadline ? new Date(data.deadline) : null,
      achievedAt: current >= targetAmount ? new Date() : null,
      note: data.note?.trim() || null,
      ownerId: ownerTeamId ? null : user.id,
      ownerTeamId,
    },
  });
  void trackActivity("portfel", "create_goal", { name, targetAmount });
  revalidatePath("/portfel/budzety");
  return goal;
}

/** Dodaje (lub odejmuje, gdy ujemne) wpłatę do celu; ustawia achievedAt po przekroczeniu targetu. */
export async function contributeGoal(id: string, amount: number): Promise<void> {
  const user = await requireAuth();
  const goal = await assertGoalAccess(id, user.id);
  if (isNaN(amount) || amount === 0) throw new Error("Podaj kwotę");
  const next = Math.max(0, goal.currentAmount + amount);
  await prisma.financeGoal.update({
    where: { id },
    data: {
      currentAmount: next,
      achievedAt: next >= goal.targetAmount ? (goal.achievedAt ?? new Date()) : null,
    },
  });
  revalidatePath("/portfel/budzety");
}

export async function updateGoal(
  id: string,
  patch: Partial<{ name: string; targetAmount: number; deadline: Date | string | null; note: string | null }>,
): Promise<void> {
  const user = await requireAuth();
  const goal = await assertGoalAccess(id, user.id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw new Error("Podaj nazwę celu");
    data.name = n;
  }
  if (patch.targetAmount !== undefined) {
    const t = Math.abs(patch.targetAmount);
    if (!t || isNaN(t)) throw new Error("Podaj kwotę docelową większą od zera");
    data.targetAmount = t;
    data.achievedAt = goal.currentAmount >= t ? (goal.achievedAt ?? new Date()) : null;
  }
  if (patch.deadline !== undefined) data.deadline = patch.deadline ? new Date(patch.deadline) : null;
  if (patch.note !== undefined) data.note = patch.note?.trim() || null;
  await prisma.financeGoal.update({ where: { id }, data });
  revalidatePath("/portfel/budzety");
}

export async function deleteGoal(id: string): Promise<void> {
  const user = await requireAuth();
  await assertGoalAccess(id, user.id);
  await prisma.financeGoal.delete({ where: { id } });
  revalidatePath("/portfel/budzety");
}

async function assertGoalAccess(id: string, userId: string): Promise<FinanceGoal> {
  const g = await prisma.financeGoal.findUnique({ where: { id } });
  if (!g) throw new Error("Cel nie istnieje");
  if (g.ownerId === userId) return g;
  if (g.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (teamIds.includes(g.ownerTeamId)) return g;
  }
  throw new Error("Brak dostępu do celu");
}
