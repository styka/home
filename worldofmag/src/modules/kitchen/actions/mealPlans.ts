"use server";

import { revalidatePath } from "next/cache";
import { assertOwnership } from "@/platform/auth/ownership";
import { prisma } from "@/platform/db/prisma";
import { requireAuth, getUserTeamIds, getAccessibleTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
import { categorize } from "@/modules/shopping/contract";
import { computeRecipeCost } from "../lib/recipeCost";
import { trackActivity } from "@/actions/activity";
import { assertListAccess } from "@/modules/shopping/contract";
import type { MealSlot, MealStatus } from "@/types/kitchen";
import type { MealPlanEntry, Item } from "@prisma/client";
import { dayKeyUTC } from "../domain/dzienPlanu";
import { dataWStrefie, userTimeZone } from "@/lib/userTime";
import { wlasnoscDoZapisu, przestrzenZespoluBezKontroliDostepu } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";

export type MealPlanEntryWithRecipe = MealPlanEntry & {
  recipe: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string | null;
    prepMinutes: number | null;
    cookMinutes: number | null;
    servings: number;
  } | null;
};

// ─── Access ───────────────────────────────────────────────────────────────

async function assertMealPlanAccess(entryId: string, userId: string): Promise<void> {
  const entry = await prisma.mealPlanEntry.findUnique({
    where: { id: entryId },
    select: { workspaceId: true },
  });
  if (!entry) throw new Error("Wpis planu nie istnieje");
  // 079: pełny zakres przestrzeni = dawne `getUserTeamIds`.
  try {
    await assertOwnership(entry, userId);
  } catch {
    throw new Error("Brak dostępu do tego wpisu planu");
  }
}

// ─── Listing ──────────────────────────────────────────────────────────────

export async function getMealPlan(
  range: { from: Date; to: Date },
  teamId?: string
): Promise<MealPlanEntryWithRecipe[]> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");

  // 095: po migracji 0244 `MealPlanEntry` nie ma już kolumny `ownerTeamId` — zawężenie do jednego
  // zespołu wyraża jego PRZESTRZEŃ. Kontrolę dostępu robi `teamIds.includes(teamId)` linijkę wyżej,
  // dlatego wolno tu użyć wariantu bez własnej kontroli.
  const ownershipFilter = teamId
    ? teamIds.includes(teamId)
      ? [{ workspaceId: await przestrzenZespoluBezKontroliDostepu(teamId) }]
      : []
    : (await ownedOrAsync(user.id));

  if (ownershipFilter.length === 0) return [];

  const entries = await prisma.mealPlanEntry.findMany({
    take: SUFIT_LISTY,
    where: {
      AND: [
        { OR: ownershipFilter },
        { date: { gte: range.from, lte: range.to } },
      ],
    },
    include: {
      recipe: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImageUrl: true,
          prepMinutes: true,
          cookMinutes: true,
          servings: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });

  return entries;
}

export interface MealPlanCost {
  total: number; // szacunkowy koszt posiłków w zakresie (suma koszt/porcja × porcje wpisu)
  pricedEntries: number; // wpisy z choć częściowo wycenionym przepisem
  totalEntries: number; // wpisy z przepisem w zakresie
}

/**
 * Z-252 (rozszerzenie) — szacunkowy koszt planu posiłków w zakresie dat.
 * Osobne, lekkie zapytanie (tylko ceny składników) — NIE obciąża `getMealPlan`
 * ani `getTodaysMeals` (ścieżki gorące: home/kalendarz). Koszt wpisu liczony
 * z `koszt/porcja` przepisu × planowane porcje wpisu.
 */
export async function getMealPlanCost(range: { from: Date; to: Date }, teamId?: string): Promise<MealPlanCost> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");
  const ownershipFilter = teamId
    ? teamIds.includes(teamId)
      ? [{ workspaceId: await przestrzenZespoluBezKontroliDostepu(teamId) }]
      : []
    : (await ownedOrAsync(user.id));
  if (ownershipFilter.length === 0) return { total: 0, pricedEntries: 0, totalEntries: 0 };

  // paginacja: kompletny — koszt planu to SUMA po wpisach zakresu.
  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      AND: [
        { OR: ownershipFilter },
        { date: { gte: range.from, lte: range.to } },
        { recipeId: { not: null } },
      ],
    },
    select: {
      servings: true,
      recipe: { select: { servings: true, ingredients: { select: { quantity: true, unitPrice: true, isOptional: true } } } },
    },
  });

  let total = 0;
  let pricedEntries = 0;
  for (const e of entries) {
    if (!e.recipe) continue;
    const c = computeRecipeCost(e.recipe.ingredients, e.recipe.servings);
    if (c.pricedCount > 0) {
      total += c.perServing * (e.servings ?? e.recipe.servings);
      pricedEntries++;
    }
  }
  return { total: Math.round(total * 100) / 100, pricedEntries, totalEntries: entries.length };
}

export async function getTodaysMeals(): Promise<MealPlanEntryWithRecipe[]> {
  // Dzień kalendarzowy w strefie UŻYTKOWNIKA, zamieniony na klucz dnia planu (południe UTC) —
  // `setHours(0/23)` na serwerze (Render = UTC) wyznaczało dobę UTC, więc między północą a 2:00
  // czasu PL briefing/pulpit pokazywał wczorajszy jadłospis. Wpisy planu żyją pod `dayKeyUTC`,
  // dlatego pytamy o dokładnie ten jeden klucz, a nie o przedział godzin.
  const dzis = dataWStrefie(userTimeZone()); // "YYYY-MM-DD"
  const klucz = dayKeyUTC(new Date(`${dzis}T12:00:00Z`));
  return getMealPlan({ from: klucz, to: klucz });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

export interface MealPlanEntryInput {
  date: Date;
  slot: MealSlot;
  recipeId?: string | null;
  customTitle?: string | null;
  servings?: number;
  notes?: string | null;
  teamId?: string | null;
}

export async function setMealPlanEntry(data: MealPlanEntryInput): Promise<MealPlanEntry> {
  const user = await requireAuth();

  if (data.teamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "kitchen");
    if (!teamIds.includes(data.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  if (!data.recipeId && !data.customTitle?.trim()) {
    throw new Error("Wybierz przepis lub wpisz własny tytuł");
  }

  const date = dayKeyUTC(data.date);

  const entry = await prisma.mealPlanEntry.create({
    data: {
      date,
      slot: data.slot,
      recipeId: data.recipeId ?? null,
      customTitle: data.customTitle?.trim() || null,
      servings: data.servings ?? 2,
      notes: data.notes?.trim() || null,
      ...(await wlasnoscDoZapisu(user.id, data.teamId)),
    },
  });

  void trackActivity("kitchen", "create_meal_plan_entry", {
    id: entry.id,
    date: date.toISOString(),
    slot: data.slot,
  });
  revalidatePath("/kitchen/plan");
  revalidatePath("/");
  return entry;
}

export async function updateMealPlanEntry(
  id: string,
  patch: Partial<Omit<MealPlanEntryInput, "teamId">> & { status?: MealStatus }
): Promise<MealPlanEntry> {
  const user = await requireAuth();
  await assertMealPlanAccess(id, user.id);

  const data: Record<string, unknown> = {};
  if (patch.date) data.date = dayKeyUTC(patch.date);
  if (patch.slot) data.slot = patch.slot;
  if (patch.recipeId !== undefined) data.recipeId = patch.recipeId;
  if (patch.customTitle !== undefined) data.customTitle = patch.customTitle?.trim() || null;
  if (patch.servings != null) data.servings = patch.servings;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.status) {
    data.status = patch.status;
    if (patch.status === "COOKED") data.cookedAt = new Date();
  }

  const entry = await prisma.mealPlanEntry.update({ where: { id }, data });
  revalidatePath("/kitchen/plan");
  revalidatePath("/");
  return entry;
}

export async function deleteMealPlanEntry(id: string): Promise<void> {
  const user = await requireAuth();
  await assertMealPlanAccess(id, user.id);
  await prisma.mealPlanEntry.delete({ where: { id } });
  revalidatePath("/kitchen/plan");
  revalidatePath("/");
}

export async function markMealCooked(id: string): Promise<void> {
  const user = await requireAuth();
  await assertMealPlanAccess(id, user.id);

  const entry = await prisma.mealPlanEntry.update({
    where: { id },
    data: { status: "COOKED", cookedAt: new Date() },
  });

  if (entry.recipeId) {
    await prisma.recipe.update({
      where: { id: entry.recipeId },
      data: { cookCount: { increment: 1 }, lastCookedAt: new Date() },
    });
  }

  revalidatePath("/kitchen/plan");
  revalidatePath("/kitchen/recipes");
  revalidatePath("/");
}

export async function markMealSkipped(id: string): Promise<void> {
  const user = await requireAuth();
  await assertMealPlanAccess(id, user.id);
  await prisma.mealPlanEntry.update({ where: { id }, data: { status: "SKIPPED" } });
  revalidatePath("/kitchen/plan");
}

// ─── Bulk create (AI plan tygodnia) ───────────────────────────────────────

export interface BulkSetInput {
  entries: Array<{
    date: Date;
    slot: MealSlot;
    recipeId?: string | null;
    customTitle?: string | null;
    servings?: number;
  }>;
  replace?: boolean;
  teamId?: string | null;
}

export interface BulkSetResult {
  added: number;
  skipped: number;
}

export async function bulkSetMealPlan(input: BulkSetInput): Promise<BulkSetResult> {
  const user = await requireAuth();

  if (input.teamId) {
    const teamIds = await getAccessibleTeamIds(user.id, "kitchen");
    if (!teamIds.includes(input.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  // 079: własność zapisujemy jednym wyliczeniem — to samo trafia do wyszukania istniejącego
  // slotu i do tworzenia nowego wpisu, więc oba na pewno mówią o tej samej przestrzeni.
  const wlasnosc = await wlasnoscDoZapisu(user.id, input.teamId);

  // Atomowo: każda iteracja (find + create/update) widzi spójny stan slotu.
  // TODO: docelowo @@unique([date, slot, ownerId]) i @@unique([date, slot, ownerTeamId])
  // w schema.prisma daje twardą gwarancję przed równoległymi zapisami.
  const { added, skipped } = await prisma.$transaction(async (tx) => {
    let added = 0;
    let skipped = 0;

    for (const e of input.entries) {
      if (!e.recipeId && !e.customTitle?.trim()) {
        skipped += 1;
        continue;
      }
      const date = dayKeyUTC(e.date);
      const existing = await tx.mealPlanEntry.findFirst({
        where: {
          date,
          slot: e.slot,
          workspaceId: wlasnosc.workspaceId,
        },
        select: { id: true },
      });

      if (existing) {
        if (!input.replace) {
          skipped += 1;
          continue;
        }
        await tx.mealPlanEntry.update({
          where: { id: existing.id },
          data: {
            recipeId: e.recipeId ?? null,
            customTitle: e.recipeId ? null : e.customTitle?.trim() || null,
            servings: e.servings ?? 2,
            status: "PLANNED",
            cookedAt: null,
          },
        });
        added += 1;
        continue;
      }

      await tx.mealPlanEntry.create({
        data: {
          date,
          slot: e.slot,
          recipeId: e.recipeId ?? null,
          customTitle: e.recipeId ? null : e.customTitle?.trim() || null,
          servings: e.servings ?? 2,
          ...wlasnosc,
        },
      });
      added += 1;
    }

    return { added, skipped };
  });

  void trackActivity("kitchen", "bulk_set_meal_plan", { added, skipped });
  revalidatePath("/kitchen/plan");
  revalidatePath("/");
  return { added, skipped };
}

// ─── Move entry (drag-and-drop) ───────────────────────────────────────────

export async function moveMealPlanEntry(
  id: string,
  targetDate: Date,
  targetSlot: MealSlot
): Promise<MealPlanEntry> {
  const user = await requireAuth();
  await assertMealPlanAccess(id, user.id);
  const entry = await prisma.mealPlanEntry.update({
    where: { id },
    data: { date: dayKeyUTC(targetDate), slot: targetSlot },
  });
  revalidatePath("/kitchen/plan");
  return entry;
}

// ─── Generate shopping list from plan ─────────────────────────────────────

export interface GenerateShoppingListInput {
  from: Date;
  to: Date;
  listId: string;
  skipPantry?: boolean;
  consolidate?: boolean;
  skipOptional?: boolean;
}

export interface GenerateShoppingListResult {
  addedItems: Item[];
  skippedFromPantry: Array<{ name: string; quantity: number | null }>;
  mergedCount: number;
}

interface AggregatedItem {
  name: string;
  productId: string | null;
  quantity: number | null;
  unit: string | null;
  category: string;
  sources: Array<{ recipeId: string; ingredientId: string; servings: number }>;
}

export interface PreviewShoppingListInput {
  from: Date;
  to: Date;
  skipPantry?: boolean;
  consolidate?: boolean;
  skipOptional?: boolean;
}

export interface ShoppingListPreviewItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  sourceCount: number;
  fromPantry: boolean;
}

export interface ShoppingListPreviewResult {
  items: ShoppingListPreviewItem[];
  skippedFromPantry: Array<{ name: string; quantity: number | null }>;
  totalIngredients: number;
  mergedCount: number;
}

export async function previewShoppingListFromPlan(
  input: PreviewShoppingListInput
): Promise<ShoppingListPreviewResult> {
  const user = await requireAuth();
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");

  const ownership = (await ownedOrAsync(user.id));

  // paginacja: kompletny — podgląd listy zakupów musi objąć cały zakres planu.
  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      AND: [
        { OR: ownership },
        { date: { gte: input.from, lte: input.to } },
        { recipeId: { not: null } },
        { status: { not: "SKIPPED" } },
      ],
    },
    include: {
      recipe: {
        include: { ingredients: { include: { product: true } } },
      },
    },
  });

  const pantry = input.skipPantry
    // paginacja: kompletny — zapasy odejmowane od podglądu listy zakupów, jak wyżej.
    ? await prisma.pantryItem.findMany({ where: { OR: ownership } })
    : [];

  function pantryHas(name: string, productId: string | null): boolean {
    return pantry.some((p) => {
      if (productId && p.productId === productId) return (p.quantity ?? 0) > 0;
      return p.name.toLowerCase() === name.toLowerCase() && (p.quantity ?? 0) > 0;
    });
  }

  const consolidated = new Map<string, AggregatedItem>();
  const passthrough: AggregatedItem[] = [];

  for (const entry of entries) {
    if (!entry.recipe) continue;
    const scale = entry.recipe.servings > 0 ? entry.servings / entry.recipe.servings : 1;
    for (const ing of entry.recipe.ingredients) {
      if (input.skipOptional && ing.isOptional) continue;
      const baseName = ing.product?.name ?? ing.name;
      const unit = ing.unit ?? ing.product?.defaultUnit ?? null;
      const category = ing.product?.category ?? categorize(baseName);
      const scaledQty = ing.quantity != null ? Math.round(ing.quantity * scale * 100) / 100 : null;
      const key = input.consolidate ? `${(ing.productId ?? baseName.toLowerCase())}::${unit ?? ""}` : null;

      const aggItem: AggregatedItem = {
        name: baseName,
        productId: ing.productId,
        quantity: scaledQty,
        unit,
        category,
        sources: [{ recipeId: entry.recipe.id, ingredientId: ing.id, servings: entry.servings }],
      };

      if (key && consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        if (existing.quantity != null && scaledQty != null) {
          existing.quantity = Math.round((existing.quantity + scaledQty) * 100) / 100;
        } else if (scaledQty != null) {
          existing.quantity = scaledQty;
        }
        existing.sources.push(...aggItem.sources);
      } else if (key) {
        consolidated.set(key, aggItem);
      } else {
        passthrough.push(aggItem);
      }
    }
  }

  const allItems = [...Array.from(consolidated.values()), ...passthrough];
  const totalIngredients = entries.reduce((sum, e) => sum + (e.recipe?.ingredients.length ?? 0), 0);
  const mergedCount = Math.max(0, totalIngredients - allItems.length);

  const items: ShoppingListPreviewItem[] = [];
  const skippedFromPantry: Array<{ name: string; quantity: number | null }> = [];
  for (const item of allItems) {
    const inPantry = Boolean(input.skipPantry) && pantryHas(item.name, item.productId);
    if (inPantry) {
      skippedFromPantry.push({ name: item.name, quantity: item.quantity });
    }
    items.push({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      sourceCount: item.sources.length,
      fromPantry: inPantry,
    });
  }

  items.sort((a, b) => {
    if (a.fromPantry !== b.fromPantry) return a.fromPantry ? 1 : -1;
    return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
  });

  return { items, skippedFromPantry, totalIngredients, mergedCount };
}

export async function generateShoppingListFromPlan(
  input: GenerateShoppingListInput
): Promise<GenerateShoppingListResult> {
  const user = await requireAuth();
  await assertListAccess(input.listId, user.id);
  const teamIds = await getAccessibleTeamIds(user.id, "kitchen");

  const ownership = (await ownedOrAsync(user.id));

  // paginacja: kompletny — wszystkie wpisy planu z zakresu trafiają na listę zakupów; ucięcie to brakujące składniki.
  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      AND: [
        { OR: ownership },
        { date: { gte: input.from, lte: input.to } },
        { recipeId: { not: null } },
        { status: { not: "SKIPPED" } },
      ],
    },
    include: {
      recipe: {
        include: { ingredients: { include: { product: true } } },
      },
    },
  });

  const pantry = input.skipPantry
    // paginacja: kompletny — zapasy w spiżarni odejmowane od listy zakupów; pominięty zapas = kupione po raz drugi.
    ? await prisma.pantryItem.findMany({
      where: { OR: ownership },
      })
    : [];

  function pantryHas(name: string, productId: string | null): boolean {
    return pantry.some((p) => {
      if (productId && p.productId === productId) return (p.quantity ?? 0) > 0;
      return p.name.toLowerCase() === name.toLowerCase() && (p.quantity ?? 0) > 0;
    });
  }

  const consolidated = new Map<string, AggregatedItem>();
  const passthrough: AggregatedItem[] = [];

  for (const entry of entries) {
    if (!entry.recipe) continue;
    const scale = entry.recipe.servings > 0 ? entry.servings / entry.recipe.servings : 1;

    for (const ing of entry.recipe.ingredients) {
      if (input.skipOptional && ing.isOptional) continue;

      const baseName = ing.product?.name ?? ing.name;
      const unit = ing.unit ?? ing.product?.defaultUnit ?? null;
      const category = ing.product?.category ?? categorize(baseName);
      const scaledQty = ing.quantity != null ? Math.round(ing.quantity * scale * 100) / 100 : null;

      const key = input.consolidate
        ? `${(ing.productId ?? baseName.toLowerCase())}::${unit ?? ""}`
        : null;

      const aggItem: AggregatedItem = {
        name: baseName,
        productId: ing.productId,
        quantity: scaledQty,
        unit,
        category,
        sources: [{ recipeId: entry.recipe.id, ingredientId: ing.id, servings: entry.servings }],
      };

      if (key && consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        if (existing.quantity != null && scaledQty != null) {
          existing.quantity = Math.round((existing.quantity + scaledQty) * 100) / 100;
        } else if (scaledQty != null) {
          existing.quantity = scaledQty;
        }
        existing.sources.push(...aggItem.sources);
      } else if (key) {
        consolidated.set(key, aggItem);
      } else {
        passthrough.push(aggItem);
      }
    }
  }

  const allItems = [...Array.from(consolidated.values()), ...passthrough];
  const initialCount = entries.reduce((sum, e) => sum + (e.recipe?.ingredients.length ?? 0), 0);
  const mergedCount = Math.max(0, initialCount - allItems.length);

  const added: Item[] = [];
  const skippedFromPantry: Array<{ name: string; quantity: number | null }> = [];

  for (const item of allItems) {
    if (input.skipPantry && pantryHas(item.name, item.productId)) {
      skippedFromPantry.push({ name: item.name, quantity: item.quantity });
      continue;
    }

    const created = await prisma.item.create({
      data: {
        listId: input.listId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        recipeOrigin: item.sources[0]
          ? {
              create: {
                recipeId: item.sources[0].recipeId,
                ingredientId: item.sources[0].ingredientId,
                servings: item.sources[0].servings,
              },
            }
          : undefined,
      },
    });
    added.push(created);
  }

  void trackActivity("kitchen", "generate_shopping_list_from_plan", {
    listId: input.listId,
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    addedCount: added.length,
    mergedCount,
  });

  revalidatePath(`/shopping/${input.listId}`);
  revalidatePath("/kitchen/plan");

  return { addedItems: added, skippedFromPantry, mergedCount };
}
