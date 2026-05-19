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

/** Saves a new SVG icon for the category and marks it active (deactivates others). */
export async function saveAndActivateCategoryIcon(
  categoryName: string,
  svgContent: string
): Promise<CategoryIconVariantData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Deactivate all existing, then create new active one
  await prisma.categoryIconVariant.updateMany({
    where: { userId: session.user.id, categoryName },
    data: { isActive: false },
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
}

/** Deletes a saved icon variant. */
export async function deleteCategoryIconVariant(variantId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const variant = await prisma.categoryIconVariant.findUnique({ where: { id: variantId } });
  if (!variant || variant.userId !== session.user.id) throw new Error("Forbidden");

  await prisma.categoryIconVariant.delete({ where: { id: variantId } });

  revalidatePath("/shopping");
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
