import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { getTodaysMeals } from "@/actions/mealPlans";
import { getExpiringSoon } from "@/actions/pantry";
import { getCookbooks } from "@/actions/cookbooks";
import { KitchenHomePage } from "@/components/kitchen/KitchenHomePage";

export const dynamic = "force-dynamic";

export default async function KitchenIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const teamIds = await getUserTeamIds(userId);
  const accessFilter = {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };

  const [recipeCount, pantryCount, todayMeals, expiring, cookbooks, recentlyCooked, latestRecipes] = await Promise.all([
    prisma.recipe.count({ where: { isArchived: false, ...accessFilter } }),
    prisma.pantryItem.count({ where: accessFilter }),
    getTodaysMeals(),
    getExpiringSoon(7),
    getCookbooks(),
    prisma.recipe.findMany({
      where: { isArchived: false, lastCookedAt: { not: null }, ...accessFilter },
      orderBy: { lastCookedAt: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImageUrl: true,
        cookCount: true,
        lastCookedAt: true,
        prepMinutes: true,
        cookMinutes: true,
        servings: true,
      },
    }),
    prisma.recipe.findMany({
      where: { isArchived: false, lastCookedAt: null, ...accessFilter },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImageUrl: true,
        prepMinutes: true,
        cookMinutes: true,
        servings: true,
      },
    }),
  ]);

  const todayMealsForUI = todayMeals.map((m) => ({
    id: m.id,
    slot: m.slot,
    title: m.recipe?.title ?? m.customTitle ?? "Bez tytułu",
    recipeSlug: m.recipe?.slug ?? null,
    servings: m.servings,
    status: m.status,
  }));

  const expiringForUI = expiring.slice(0, 5).map((e) => {
    const now = new Date();
    const days = e.expiresAt
      ? Math.ceil((new Date(e.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    return {
      id: e.id,
      name: e.name,
      daysLeft: days,
    };
  });

  const expiringSoonCount = expiringForUI.filter((e) => e.daysLeft <= 3).length;

  const recentlyCookedForUI = recentlyCooked.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    coverImageUrl: r.coverImageUrl,
    cookCount: r.cookCount,
    lastCookedAt: r.lastCookedAt ? r.lastCookedAt.toISOString() : null,
    totalMinutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0),
    servings: r.servings,
  }));

  const latestRecipesForUI = latestRecipes.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    coverImageUrl: r.coverImageUrl,
    totalMinutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0),
    servings: r.servings,
  }));

  const cookbooksForUI = cookbooks.slice(0, 6).map((cb) => ({
    id: cb.id,
    name: cb.name,
    emoji: cb.emoji,
    color: cb.color,
    recipeCount: cb.recipeCount,
  }));

  return (
    <KitchenHomePage
      recipeCount={recipeCount}
      pantryCount={pantryCount}
      todayMeals={todayMealsForUI}
      expiring={expiringForUI}
      expiringSoonCount={expiringSoonCount}
      recentlyCooked={recentlyCookedForUI}
      latestRecipes={latestRecipesForUI}
      cookbooks={cookbooksForUI}
      totalCookbooks={cookbooks.length}
    />
  );
}
