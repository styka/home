"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CategoryIconVariantData = {
  id: string;
  categoryName: string;
  svgContent: string;
  isActive: boolean;
  createdAt: Date;
};

/** Saves a new SVG icon for the category, replacing any existing one (max 1 per category). */
export async function saveAndActivateCategoryIcon(
  categoryName: string,
  svgContent: string
): Promise<CategoryIconVariantData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Delete any existing icon for this category (enforce max 1)
  await prisma.categoryIconVariant.deleteMany({
    where: { userId: session.user.id, categoryName },
  });

  const variant = await prisma.categoryIconVariant.create({
    data: { categoryName, svgContent, isActive: true, userId: session.user.id },
  });

  revalidatePath("/shopping");
  return variant;
}

/** Switches the active icon to an existing variant (deactivates others). */
export async function setActiveCategoryIcon(variantId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const variant = await prisma.categoryIconVariant.findUnique({ where: { id: variantId } });
  if (!variant || variant.userId !== session.user.id) throw new Error("Forbidden");

  await prisma.$transaction([
    prisma.categoryIconVariant.updateMany({
      where: { userId: session.user.id, categoryName: variant.categoryName },
      data: { isActive: false },
    }),
    prisma.categoryIconVariant.update({
      where: { id: variantId },
      data: { isActive: true },
    }),
  ]);

  revalidatePath("/shopping");
  revalidatePath("/shopping/icons");
}

/** Deactivates all icons for a category (reverts to default emoji). */
export async function deactivateCategoryIcon(categoryName: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.categoryIconVariant.updateMany({
    where: { userId: session.user.id, categoryName },
    data: { isActive: false },
  });

  revalidatePath("/shopping");
  revalidatePath("/shopping/icons");
}

/** Deletes a saved icon variant. */
export async function deleteCategoryIconVariant(variantId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const variant = await prisma.categoryIconVariant.findUnique({ where: { id: variantId } });
  if (!variant || variant.userId !== session.user.id) throw new Error("Forbidden");

  await prisma.categoryIconVariant.delete({ where: { id: variantId } });

  revalidatePath("/shopping");
  revalidatePath("/shopping/icons");
}

/** Returns all saved icon variants for a category (newest first). */
export async function getCategoryIconVariants(
  categoryName: string
): Promise<CategoryIconVariantData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.categoryIconVariant.findMany({
    where: { userId: session.user.id, categoryName },
    orderBy: { createdAt: "desc" },
  });
}

/** Returns map of categoryName → svgContent for all active icons of the current user. */
export async function getActiveCategoryIconMap(): Promise<Record<string, string>> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const active = await prisma.categoryIconVariant.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { categoryName: true, svgContent: true },
  });

  return Object.fromEntries(active.map((v) => [v.categoryName, v.svgContent]));
}

/** Returns all icon variants for all categories of the current user, grouped by category. */
export async function getAllUserIconVariants(): Promise<Record<string, CategoryIconVariantData[]>> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const all = await prisma.categoryIconVariant.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const grouped: Record<string, CategoryIconVariantData[]> = {};
  for (const v of all) {
    if (!grouped[v.categoryName]) grouped[v.categoryName] = [];
    grouped[v.categoryName].push(v);
  }
  return grouped;
}

/** Returns all icon variants for the current user as a flat list (newest first). */
export async function getAllUserIconVariantsFlat(): Promise<CategoryIconVariantData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.categoryIconVariant.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
}

/** Saves an SVG icon to the library without making it active for any category. */
export async function saveToLibrary(
  svgContent: string,
  theme?: string
): Promise<CategoryIconVariantData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const variant = await prisma.categoryIconVariant.create({
    data: {
      categoryName: theme?.trim() || "__library__",
      svgContent,
      isActive: false,
      userId: session.user.id,
    },
  });

  revalidatePath("/shopping/icons");
  return variant;
}

/** Assigns an icon from the library to a category, replacing any existing icon (max 1 per category). */
export async function assignIconToCategory(
  variantId: string,
  targetCategory: string
): Promise<CategoryIconVariantData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const variant = await prisma.categoryIconVariant.findUnique({ where: { id: variantId } });
  if (!variant || variant.userId !== session.user.id) throw new Error("Forbidden");

  // Delete any existing icon for the target category (enforce max 1)
  await prisma.categoryIconVariant.deleteMany({
    where: { userId: session.user.id, categoryName: targetCategory, id: { not: variantId } },
  });

  // Move the icon to the target category and activate
  const updated = await prisma.categoryIconVariant.update({
    where: { id: variantId },
    data: { categoryName: targetCategory, isActive: true },
  });

  revalidatePath("/shopping");
  revalidatePath("/shopping/icons");
  return updated;
}

/** Moves all icon variants for a category to __library__ (called before category deletion). */
export async function orphanCategoryIcons(categoryName: string, userId: string): Promise<void> {
  await prisma.categoryIconVariant.updateMany({
    where: { userId, categoryName },
    data: { categoryName: "__library__", isActive: false },
  });
}
export async function upsertCategoryEmojiOverride(
  categoryName: string,
  emoji: string
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await prisma.category.findFirst({
    where: { name: categoryName, userId: session.user.id, teamId: null },
  });
  if (existing) {
    await prisma.category.update({ where: { id: existing.id }, data: { emoji } });
  } else {
    await prisma.category.create({ data: { name: categoryName, emoji, userId: session.user.id } });
  }

  revalidatePath("/shopping");
  revalidatePath("/shopping/categories");
}
