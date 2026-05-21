"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { categorize } from "@/lib/categorize";
import { trackActivity } from "@/actions/activity";
import { assertListAccess } from "@/actions/lists";
import type { MealSlot, MealStatus } from "@/types/kitchen";
import type { MealPlanEntry, Item } from "@prisma/client";

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
  const teamIds = await getUserTeamIds(userId);
  const entry = await prisma.mealPlanEntry.findUnique({
    where: { id: entryId },
    select: { ownerId: true, ownerTeamId: true },
  });
  if (!entry) throw new Error("Wpis planu nie istnieje");
  if (entry.ownerId === userId) return;
  if (entry.ownerTeamId && teamIds.includes(entry.ownerTeamId)) return;
  throw new Error("Brak dostępu do tego wpisu planu");
}

// ─── Date helpers ─────────────────────────────────────────────────────────

// 12:00 UTC jako stabilny midpoint dnia — odporne na drift timezone
// przy zapisie/odczycie z DB. setUTCHours(0,…) w PL skutkowałoby przesunięciem
// daty o dzień; noon UTC nigdy nie zmieni dnia kalendarzowego dla żadnego TZ.
function dayKeyUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

// ─── Listing ──────────────────────────────────────────────────────────────

export async function getMealPlan(
  range: { from: Date; to: Date },
  teamId?: string
): Promise<MealPlanEntryWithRecipe[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const ownershipFilter = teamId
    ? teamIds.includes(teamId)
      ? [{ ownerTeamId: teamId }]
      : []
    : [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ];

  if (ownershipFilter.length === 0) return [];

  const entries = await prisma.mealPlanEntry.findMany({
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

export async function getTodaysMeals(): Promise<MealPlanEntryWithRecipe[]> {
  const today = new Date();
  const from = new Date(today);
  from.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setHours(23, 59, 59, 999);
  return getMealPlan({ from, to });
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
    const teamIds = await getUserTeamIds(user.id);
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
      ownerId: data.teamId ? null : user.id,
      ownerTeamId: data.teamId ?? null,
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
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(input.teamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const ownerId = input.teamId ? null : user.id;
  const ownerTeamId = input.teamId ?? null;

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
          ...(ownerTeamId ? { ownerTeamId } : { ownerId }),
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
          ownerId,
          ownerTeamId,
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
  const teamIds = await getUserTeamIds(user.id);

  const ownership = [
    { ownerId: user.id },
    ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
  ];

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
  const teamIds = await getUserTeamIds(user.id);

  const ownership = [
    { ownerId: user.id },
    ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
  ];

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
