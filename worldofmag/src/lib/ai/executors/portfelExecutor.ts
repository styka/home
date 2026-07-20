// Z-010: handler akcji asystenta dla modułu Portfel (wpisy + elementy).
// Scala trzy dawne bloki `module === "portfel"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { addEntry, getWalletElements, createElement, updateElement, setBalance, archiveElement, deleteElement } from "@/actions/portfel";
import { createBudget, createGoal, contributeGoal, updateBudget, deleteBudget, updateGoal, deleteGoal } from "@/actions/portfelBudgets";
import { asStr, resolveByName, ownerOrArr } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executePortfelAction(action: AIAction, userId: string): Promise<string> {
  const { type, params, searchQuery } = action;

  if (type === "create_budget") {
    const category = asStr(params.category);
    const limitAmount = Number(params.limitAmount ?? params.amount);
    if (!category) throw new Error("Podaj kategorię budżetu");
    if (!limitAmount || isNaN(limitAmount) || limitAmount <= 0) throw new Error("Podaj limit budżetu większy od zera");
    await createBudget({ category, limitAmount, note: asStr(params.note) ?? null });
    return `Utworzono budżet „${category}" z limitem ${limitAmount} zł`;
  }

  if (type === "create_goal") {
    const name = asStr(params.name);
    const targetAmount = Number(params.targetAmount ?? params.amount);
    if (!name) throw new Error("Podaj nazwę celu");
    if (!targetAmount || isNaN(targetAmount) || targetAmount <= 0) throw new Error("Podaj kwotę docelową większą od zera");
    await createGoal({
      name,
      targetAmount,
      currentAmount: params.currentAmount != null ? Number(params.currentAmount) : 0,
      deadline: asStr(params.deadline) ?? null,
      note: asStr(params.note) ?? null,
    });
    return `Utworzono cel oszczędnościowy „${name}" (${targetAmount} zł)`;
  }

  if (type === "contribute_goal") {
    const amount = Number(params.amount);
    if (!amount || isNaN(amount)) throw new Error("Podaj kwotę wpłaty");
    const teamOr = await ownerOrArr(userId);
    const id = await resolveByName(
      (w) => prisma.financeGoal.findFirst({ where: w, select: { id: true } }),
      teamOr,
      asStr(params.goalId),
      "name",
      searchQuery ?? asStr(params.goalName),
      "cel oszczędnościowy"
    );
    await contributeGoal(id, amount);
    return `Dodano ${amount} zł do celu oszczędnościowego`;
  }

  if (type === "update_budget" || type === "delete_budget") {
    const teamOr = await ownerOrArr(userId);
    const id = await resolveByName(
      (w) => prisma.budget.findFirst({ where: w, select: { id: true } }),
      teamOr, asStr(params.budgetId), "category", searchQuery ?? asStr(params.category), "budżet"
    );
    if (type === "delete_budget") { await deleteBudget(id); return `Usunięto budżet`; }
    const patch: Parameters<typeof updateBudget>[1] = {};
    if (params.category !== undefined) patch.category = String(params.category);
    if (params.limitAmount !== undefined) patch.limitAmount = Number(params.limitAmount);
    if (params.note !== undefined) patch.note = asStr(params.note) ?? null;
    await updateBudget(id, patch);
    return `Zaktualizowano budżet`;
  }

  if (type === "update_goal" || type === "delete_goal") {
    const teamOr = await ownerOrArr(userId);
    const id = await resolveByName(
      (w) => prisma.financeGoal.findFirst({ where: w, select: { id: true } }),
      teamOr, asStr(params.goalId), "name", searchQuery ?? asStr(params.name), "cel oszczędnościowy"
    );
    if (type === "delete_goal") { await deleteGoal(id); return `Usunięto cel oszczędnościowy`; }
    const patch: Parameters<typeof updateGoal>[1] = {};
    if (params.name !== undefined) patch.name = String(params.name);
    if (params.targetAmount !== undefined) patch.targetAmount = Number(params.targetAmount);
    if (params.deadline !== undefined) patch.deadline = asStr(params.deadline) ?? null;
    if (params.note !== undefined) patch.note = asStr(params.note) ?? null;
    await updateGoal(id, patch);
    return `Zaktualizowano cel oszczędnościowy`;
  }

  if (type === "add_expense" || type === "add_income") {
    const amount = Number(params.amount);
    if (!amount || isNaN(amount) || amount <= 0) throw new Error("Podaj kwotę większą od zera");
    const kind: "expense" | "income" = type === "add_expense" ? "expense" : "income";
    const elementName = asStr(params.elementName);
    const elements = await getWalletElements();
    let element = elements[0];
    if (elementName) {
      const found = elements.find((e) => e.name.toLowerCase().includes(elementName.toLowerCase()));
      if (found) element = found;
    }
    if (!element) throw new Error("Brak elementów portfela — utwórz konto w /portfel");
    await addEntry(element.id, {
      kind,
      amount,
      category: asStr(params.category) ?? null,
      note: asStr(params.note) ?? null,
    });
    const prefix = kind === "expense" ? "Wydatek" : "Przychód";
    return `${prefix} ${amount} zł${params.category ? ` (${params.category})` : ""} dodany do „${element.name}"`;
  }

  if (type === "create_wallet_element") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę elementu portfela");
    const el = await createElement({
      name,
      kind: asStr(params.kind),
      initialBalance: params.initialBalance != null ? Number(params.initialBalance) : 0,
    });
    return `Utworzono element portfela „${el.name}"`;
  }

  const teamOr = await ownerOrArr(userId);
  const resolveEl = () => resolveByName((w) => prisma.walletElement.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.elementId), "name", searchQuery ?? asStr(params.elementName), "element portfela");
  if (type === "update_wallet_element") {
    const id = await resolveEl();
    await updateElement(id, { name: asStr(params.name), note: asStr(params.note) ?? null });
    return `Zaktualizowano element portfela`;
  }
  if (type === "set_wallet_balance") {
    const id = await resolveEl();
    const targetBalance = Number(params.amount ?? params.targetBalance);
    if (isNaN(targetBalance)) throw new Error("Podaj docelowe saldo");
    await setBalance(id, { targetBalance, note: asStr(params.note) ?? null });
    return `Ustawiono saldo na ${targetBalance}`;
  }
  if (type === "archive_wallet_element") {
    const id = await resolveEl();
    await archiveElement(id, params.archived !== false);
    return params.archived === false ? `Przywrócono element portfela` : `Zarchiwizowano element portfela`;
  }
  if (type === "delete_wallet_element") {
    const id = await resolveEl();
    await deleteElement(id);
    return `Usunięto element portfela`;
  }

  throw new Error(`Nieznany typ akcji portfela: ${type}`);
}
