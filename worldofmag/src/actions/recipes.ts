"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserTeamIds } from "@/lib/server-utils";
import { categorize } from "@/lib/categorize";
import { trackActivity } from "@/actions/activity";
import { assertListAccess } from "@/actions/lists";
import type {
  RecipeListItem,
  RecipeFull,
  CreateRecipeInput,
  UpdateRecipeInput,
  IngredientInput,
  StepInput,
  MealType,
  Difficulty,
} from "@/types/kitchen";
import type { Recipe, RecipeIngredient, RecipeStep, RecipeImage, Item } from "@prisma/client";

// ─── Access control ───────────────────────────────────────────────────────

export async function assertRecipeAccess(
  recipeId: string,
  userId: string,
  mode: "read" | "edit" = "edit"
): Promise<void> {
  const teamIds = await getUserTeamIds(userId);
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { ownerId: true, ownerTeamId: true, isPublic: true },
  });
  if (!recipe) throw new Error("Przepis nie istnieje");
  if (recipe.ownerId === userId) return;
  if (recipe.ownerTeamId && teamIds.includes(recipe.ownerTeamId)) return;
  if (mode === "read" && recipe.isPublic) return;
  throw new Error("Brak dostępu do tego przepisu");
}

// ─── Slug helpers ─────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "przepis";
}

async function uniqueSlug(title: string, existingId?: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let i = 1;
  while (true) {
    const found = await prisma.recipe.findUnique({ where: { slug } });
    if (!found || found.id === existingId) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

// ─── Listing & detail ─────────────────────────────────────────────────────

export async function getRecipes(opts?: {
  search?: string;
  tagIds?: string[];
  cookbookId?: string;
  cuisine?: string;
  mealType?: MealType;
  maxMinutes?: number;
  ownedOnly?: boolean;
}): Promise<RecipeListItem[]> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const ownership = opts?.ownedOnly
    ? [{ ownerId: user.id }]
    : [
        { ownerId: user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ];

  const where: Record<string, unknown> = {
    isArchived: false,
    OR: ownership,
  };

  if (opts?.cookbookId) where.cookbookId = opts.cookbookId;
  if (opts?.cuisine) where.cuisine = opts.cuisine;
  if (opts?.mealType) where.mealType = opts.mealType;
  if (opts?.tagIds && opts.tagIds.length > 0) {
    where.tags = { some: { tagId: { in: opts.tagIds } } };
  }
  if (opts?.search) {
    const q = opts.search.trim();
    if (q) {
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }
  }

  const recipes = await prisma.recipe.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      coverImageUrl: true,
      prepMinutes: true,
      cookMinutes: true,
      servings: true,
      difficulty: true,
      cuisine: true,
      mealType: true,
      cookCount: true,
      lastCookedAt: true,
      rating: true,
      ownerId: true,
      ownerTeamId: true,
      cookbookId: true,
      isPublic: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      tags: { include: { tag: true } },
    },
    orderBy: [{ lastCookedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
  });

  let filtered = recipes;
  if (opts?.maxMinutes != null) {
    const max = opts.maxMinutes;
    filtered = filtered.filter((r) => (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) <= max);
  }

  return filtered as unknown as RecipeListItem[];
}

export async function getRecipe(slugOrId: string): Promise<RecipeFull | null> {
  const user = await requireAuth();
  const teamIds = await getUserTeamIds(user.id);

  const recipe = await prisma.recipe.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    include: {
      ingredients: { include: { product: true }, orderBy: { order: "asc" } },
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
      cookbook: true,
    },
  });

  if (!recipe) return null;

  const hasAccess =
    recipe.ownerId === user.id ||
    (recipe.ownerTeamId && teamIds.includes(recipe.ownerTeamId)) ||
    recipe.isPublic;
  if (!hasAccess) return null;

  return recipe as unknown as RecipeFull;
}

// ─── Create / update / delete ─────────────────────────────────────────────

export async function createRecipe(data: CreateRecipeInput): Promise<Recipe> {
  const user = await requireAuth();

  if (data.ownerTeamId) {
    const teamIds = await getUserTeamIds(user.id);
    if (!teamIds.includes(data.ownerTeamId)) throw new Error("Nie jesteś członkiem tego teamu");
  }

  const title = data.title.trim();
  if (!title) throw new Error("Tytuł przepisu jest wymagany");

  const slug = await uniqueSlug(title);

  const recipe = await prisma.recipe.create({
    data: {
      title,
      slug,
      description: data.description?.trim() || null,
      servings: data.servings ?? 2,
      prepMinutes: data.prepMinutes ?? null,
      cookMinutes: data.cookMinutes ?? null,
      difficulty: (data.difficulty as Difficulty | undefined) ?? "easy",
      cuisine: data.cuisine?.trim() || null,
      mealType: data.mealType ?? null,
      coverImageUrl: data.coverImageUrl?.trim() || null,
      notes: data.notes ?? "",
      introMarkdown: data.introMarkdown ?? "",
      cookbookId: data.cookbookId ?? null,
      ownerId: data.ownerTeamId ? null : user.id,
      ownerTeamId: data.ownerTeamId ?? null,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
      ingredients: data.ingredients?.length
        ? {
            create: data.ingredients.map((ing, idx) => ({
              name: ing.name.trim(),
              productId: ing.productId ?? null,
              quantity: ing.quantity ?? null,
              unit: ing.unit ?? null,
              groupName: ing.groupName ?? null,
              note: ing.note ?? null,
              isOptional: ing.isOptional ?? false,
              order: ing.order ?? idx,
            })),
          }
        : undefined,
      steps: data.steps?.length
        ? {
            create: data.steps.map((s, idx) => ({
              text: s.text,
              order: s.order ?? idx,
              durationMin: s.durationMin ?? null,
              temperature: s.temperature ?? null,
              imageUrl: s.imageUrl ?? null,
            })),
          }
        : undefined,
    },
  });

  void trackActivity("kitchen", "create_recipe", { id: recipe.id, title });
  revalidatePath("/kitchen/recipes");
  return recipe;
}

export async function updateRecipe(id: string, data: UpdateRecipeInput): Promise<Recipe> {
  const user = await requireAuth();
  await assertRecipeAccess(id, user.id, "edit");

  const patch: Record<string, unknown> = {};
  if (data.title != null) {
    patch.title = data.title.trim();
    patch.slug = await uniqueSlug(patch.title as string, id);
  }
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.servings != null) patch.servings = data.servings;
  if (data.prepMinutes !== undefined) patch.prepMinutes = data.prepMinutes;
  if (data.cookMinutes !== undefined) patch.cookMinutes = data.cookMinutes;
  if (data.difficulty != null) patch.difficulty = data.difficulty;
  if (data.cuisine !== undefined) patch.cuisine = data.cuisine?.trim() || null;
  if (data.mealType !== undefined) patch.mealType = data.mealType;
  if (data.coverImageUrl !== undefined) patch.coverImageUrl = data.coverImageUrl?.trim() || null;
  if (data.notes !== undefined) patch.notes = data.notes ?? "";
  if (data.introMarkdown !== undefined) patch.introMarkdown = data.introMarkdown ?? "";
  if (data.cookbookId !== undefined) patch.cookbookId = data.cookbookId;

  const recipe = await prisma.recipe.update({ where: { id }, data: patch });

  if (data.tagIds) {
    await prisma.recipeTag.deleteMany({ where: { recipeId: id } });
    if (data.tagIds.length > 0) {
      await prisma.recipeTag.createMany({
        data: data.tagIds.map((tagId) => ({ recipeId: id, tagId })),
      });
    }
  }

  revalidatePath("/kitchen/recipes");
  revalidatePath(`/kitchen/recipes/${recipe.slug}`);
  return recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const user = await requireAuth();
  await assertRecipeAccess(id, user.id, "edit");
  await prisma.recipe.delete({ where: { id } });
  revalidatePath("/kitchen/recipes");
}

export async function archiveRecipe(id: string): Promise<void> {
  const user = await requireAuth();
  await assertRecipeAccess(id, user.id, "edit");
  await prisma.recipe.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/kitchen/recipes");
}

export async function duplicateRecipe(id: string): Promise<Recipe> {
  const user = await requireAuth();
  await assertRecipeAccess(id, user.id, "read");

  const src = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true, steps: true, tags: true },
  });
  if (!src) throw new Error("Przepis nie istnieje");

  const title = `${src.title} (kopia)`;
  const slug = await uniqueSlug(title);

  const copy = await prisma.recipe.create({
    data: {
      title,
      slug,
      description: src.description,
      introMarkdown: src.introMarkdown,
      notes: src.notes,
      servings: src.servings,
      prepMinutes: src.prepMinutes,
      cookMinutes: src.cookMinutes,
      difficulty: src.difficulty,
      cuisine: src.cuisine,
      mealType: src.mealType,
      coverImageUrl: src.coverImageUrl,
      cookbookId: src.cookbookId,
      ownerId: user.id,
      ownerTeamId: null,
      sourceType: "manual",
      tags: { create: src.tags.map((t) => ({ tagId: t.tagId })) },
      ingredients: {
        create: src.ingredients.map((ing) => ({
          name: ing.name,
          productId: ing.productId,
          quantity: ing.quantity,
          unit: ing.unit,
          groupName: ing.groupName,
          note: ing.note,
          isOptional: ing.isOptional,
          order: ing.order,
        })),
      },
      steps: {
        create: src.steps.map((s) => ({
          text: s.text,
          order: s.order,
          durationMin: s.durationMin,
          temperature: s.temperature,
          imageUrl: s.imageUrl,
        })),
      },
    },
  });

  revalidatePath("/kitchen/recipes");
  return copy;
}

// ─── Ingredients ──────────────────────────────────────────────────────────

export async function addIngredient(recipeId: string, data: IngredientInput): Promise<RecipeIngredient> {
  const user = await requireAuth();
  await assertRecipeAccess(recipeId, user.id, "edit");

  const last = await prisma.recipeIngredient.findFirst({
    where: { recipeId, groupName: data.groupName ?? null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = data.order ?? (last ? last.order + 1 : 0);

  const ing = await prisma.recipeIngredient.create({
    data: {
      recipeId,
      name: data.name.trim(),
      productId: data.productId ?? null,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      groupName: data.groupName ?? null,
      note: data.note ?? null,
      isOptional: data.isOptional ?? false,
      order,
    },
  });

  revalidatePath(`/kitchen/recipes`);
  return ing;
}

export async function updateIngredient(id: string, data: IngredientInput): Promise<RecipeIngredient> {
  const user = await requireAuth();
  const existing = await prisma.recipeIngredient.findUnique({ where: { id }, select: { recipeId: true } });
  if (!existing) throw new Error("Składnik nie istnieje");
  await assertRecipeAccess(existing.recipeId, user.id, "edit");

  const ing = await prisma.recipeIngredient.update({
    where: { id },
    data: {
      name: data.name.trim(),
      productId: data.productId ?? null,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      groupName: data.groupName ?? null,
      note: data.note ?? null,
      isOptional: data.isOptional ?? false,
      ...(data.order != null ? { order: data.order } : {}),
    },
  });

  revalidatePath(`/kitchen/recipes`);
  return ing;
}

export async function deleteIngredient(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.recipeIngredient.findUnique({ where: { id }, select: { recipeId: true } });
  if (!existing) return;
  await assertRecipeAccess(existing.recipeId, user.id, "edit");
  await prisma.recipeIngredient.delete({ where: { id } });
  revalidatePath(`/kitchen/recipes`);
}

export async function reorderIngredients(recipeId: string, orderedIds: string[]): Promise<void> {
  const user = await requireAuth();
  await assertRecipeAccess(recipeId, user.id, "edit");
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.recipeIngredient.update({ where: { id }, data: { order: idx } })
    )
  );
  revalidatePath(`/kitchen/recipes`);
}

// ─── Steps ────────────────────────────────────────────────────────────────

export async function addStep(recipeId: string, data: StepInput): Promise<RecipeStep> {
  const user = await requireAuth();
  await assertRecipeAccess(recipeId, user.id, "edit");

  const last = await prisma.recipeStep.findFirst({
    where: { recipeId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = data.order ?? (last ? last.order + 1 : 0);

  const step = await prisma.recipeStep.create({
    data: {
      recipeId,
      text: data.text,
      order,
      durationMin: data.durationMin ?? null,
      temperature: data.temperature ?? null,
      imageUrl: data.imageUrl ?? null,
    },
  });

  revalidatePath(`/kitchen/recipes`);
  return step;
}

export async function updateStep(id: string, data: StepInput): Promise<RecipeStep> {
  const user = await requireAuth();
  const existing = await prisma.recipeStep.findUnique({ where: { id }, select: { recipeId: true } });
  if (!existing) throw new Error("Krok nie istnieje");
  await assertRecipeAccess(existing.recipeId, user.id, "edit");

  const step = await prisma.recipeStep.update({
    where: { id },
    data: {
      text: data.text,
      ...(data.order != null ? { order: data.order } : {}),
      durationMin: data.durationMin ?? null,
      temperature: data.temperature ?? null,
      imageUrl: data.imageUrl ?? null,
    },
  });

  revalidatePath(`/kitchen/recipes`);
  return step;
}

export async function deleteStep(id: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.recipeStep.findUnique({ where: { id }, select: { recipeId: true } });
  if (!existing) return;
  await assertRecipeAccess(existing.recipeId, user.id, "edit");
  await prisma.recipeStep.delete({ where: { id } });
  revalidatePath(`/kitchen/recipes`);
}

export async function reorderSteps(recipeId: string, orderedIds: string[]): Promise<void> {
  const user = await requireAuth();
  await assertRecipeAccess(recipeId, user.id, "edit");
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.recipeStep.update({ where: { id }, data: { order: idx } })
    )
  );
  revalidatePath(`/kitchen/recipes`);
}

// ─── Images / attachments ─────────────────────────────────────────────────

async function revalidateRecipeById(recipeId: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { slug: true } });
  revalidatePath("/kitchen/recipes");
  if (recipe?.slug) {
    revalidatePath(`/kitchen/recipes/${recipe.slug}`);
    revalidatePath(`/kitchen/recipes/${recipe.slug}/edit`);
  }
}

export async function addRecipeImage(
  recipeId: string,
  data: { url: string; caption?: string | null }
): Promise<RecipeImage> {
  const user = await requireAuth();
  await assertRecipeAccess(recipeId, user.id, "edit");
  if (!data.url?.trim()) throw new Error("Brak obrazu");

  const last = await prisma.recipeImage.findFirst({
    where: { recipeId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const image = await prisma.recipeImage.create({
    data: {
      recipeId,
      url: data.url,
      caption: data.caption?.trim() || null,
      order: last ? last.order + 1 : 0,
    },
  });

  await revalidateRecipeById(recipeId);
  return image;
}

export async function updateRecipeImage(
  imageId: string,
  data: { caption?: string | null; ocrMarkdown?: string | null }
): Promise<RecipeImage> {
  const user = await requireAuth();
  const existing = await prisma.recipeImage.findUnique({ where: { id: imageId }, select: { recipeId: true } });
  if (!existing) throw new Error("Zdjęcie nie istnieje");
  await assertRecipeAccess(existing.recipeId, user.id, "edit");

  const image = await prisma.recipeImage.update({
    where: { id: imageId },
    data: {
      ...(data.caption !== undefined ? { caption: data.caption?.trim() || null } : {}),
      ...(data.ocrMarkdown !== undefined ? { ocrMarkdown: data.ocrMarkdown } : {}),
    },
  });

  await revalidateRecipeById(existing.recipeId);
  return image;
}

export async function deleteRecipeImage(imageId: string): Promise<void> {
  const user = await requireAuth();
  const existing = await prisma.recipeImage.findUnique({ where: { id: imageId }, select: { recipeId: true } });
  if (!existing) return;
  await assertRecipeAccess(existing.recipeId, user.id, "edit");
  await prisma.recipeImage.delete({ where: { id: imageId } });
  await revalidateRecipeById(existing.recipeId);
}

// ─── Shop for recipe ──────────────────────────────────────────────────────

export interface ShopForRecipeInput {
  recipeId: string;
  listId: string;
  servings: number;
  skipPantry?: boolean;
  skipOptional?: boolean;
  ingredientOverrides?: Array<{ ingredientId: string; include: boolean; quantity?: number }>;
}

export interface ShopForRecipeResult {
  addedItems: Item[];
  skippedFromPantry: Array<{ name: string; quantity: number | null }>;
  skippedOptional: number;
}

export async function shopForRecipe(input: ShopForRecipeInput): Promise<ShopForRecipeResult> {
  const user = await requireAuth();
  await assertRecipeAccess(input.recipeId, user.id, "read");
  await assertListAccess(input.listId, user.id);

  const recipe = await prisma.recipe.findUnique({
    where: { id: input.recipeId },
    include: { ingredients: { include: { product: true } } },
  });
  if (!recipe) throw new Error("Przepis nie istnieje");

  const scale = recipe.servings > 0 ? input.servings / recipe.servings : 1;
  const overrides = new Map(
    (input.ingredientOverrides ?? []).map((o) => [o.ingredientId, o])
  );

  const teamIds = await getUserTeamIds(user.id);
  const pantry = input.skipPantry
    ? await prisma.pantryItem.findMany({
        where: {
          OR: [
            { ownerId: user.id },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
          ],
        },
      })
    : [];

  function pantryHas(name: string, productId: string | null): boolean {
    return pantry.some((p) => {
      if (productId && p.productId === productId) return (p.quantity ?? 0) > 0;
      return p.name.toLowerCase() === name.toLowerCase() && (p.quantity ?? 0) > 0;
    });
  }

  const added: Item[] = [];
  const skippedFromPantry: Array<{ name: string; quantity: number | null }> = [];
  let skippedOptional = 0;

  for (const ing of recipe.ingredients) {
    const ov = overrides.get(ing.id);
    if (ov && ov.include === false) continue;

    if (ing.isOptional && input.skipOptional) {
      skippedOptional += 1;
      continue;
    }

    const baseName = ing.product?.name ?? ing.name;
    if (input.skipPantry && pantryHas(baseName, ing.productId)) {
      skippedFromPantry.push({
        name: baseName,
        quantity: ing.quantity != null ? ing.quantity * scale : null,
      });
      continue;
    }

    const scaledQuantity =
      ov?.quantity != null
        ? ov.quantity
        : ing.quantity != null
        ? Math.round(ing.quantity * scale * 100) / 100
        : null;

    const unit = ing.unit ?? ing.product?.defaultUnit ?? null;
    const category = ing.product?.category ?? categorize(baseName);

    const item = await prisma.item.create({
      data: {
        listId: input.listId,
        name: baseName,
        quantity: scaledQuantity,
        unit,
        category,
        recipeOrigin: {
          create: {
            recipeId: recipe.id,
            servings: input.servings,
            ingredientId: ing.id,
          },
        },
      },
    });
    added.push(item);
  }

  void trackActivity("kitchen", "shop_for_recipe", {
    recipeId: recipe.id,
    listId: input.listId,
    addedCount: added.length,
    servings: input.servings,
  });

  revalidatePath(`/shopping/${input.listId}`);
  revalidatePath("/kitchen/recipes");
  return { addedItems: added, skippedFromPantry, skippedOptional };
}

// ─── Cook tracking ────────────────────────────────────────────────────────

export async function markRecipeCooked(id: string, servings: number): Promise<void> {
  const user = await requireAuth();
  await assertRecipeAccess(id, user.id, "read");

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      cookCount: { increment: 1 },
      lastCookedAt: new Date(),
    },
    select: { slug: true },
  });

  void trackActivity("kitchen", "mark_cooked", { recipeId: id, servings });
  revalidatePath("/kitchen/recipes");
  revalidatePath(`/kitchen/recipes/${updated.slug}`);
}
