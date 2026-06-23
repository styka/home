export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMealPlan, getMealPlanCost } from "@/actions/mealPlans";
import { getRecipes } from "@/actions/recipes";
import { getLists } from "@/actions/lists";
import { getWeekStart, getWeekEnd, dateKey } from "@/lib/kitchenDate";
import { MealPlanWeek } from "@/components/kitchen/plan/MealPlanWeek";

interface PageProps {
  searchParams: { week?: string };
}

export default async function KitchenPlanPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const anchor = searchParams.week ? new Date(`${searchParams.week}T12:00:00`) : new Date();
  const from = getWeekStart(anchor);
  const to = getWeekEnd(anchor);

  const [entries, recipes, lists, weekCost] = await Promise.all([
    getMealPlan({ from, to }),
    getRecipes(),
    getLists(),
    getMealPlanCost({ from, to }),
  ]);
  const hasAI = session.user.permissions?.includes("kitchen.ai") ?? false;

  return (
    <MealPlanWeek
      initialWeek={dateKey(anchor)}
      weekCost={weekCost}
      entries={entries.map((e) => ({
        ...e,
        date: new Date(e.date),
        cookedAt: e.cookedAt ? new Date(e.cookedAt) : null,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      }))}
      recipes={recipes.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        servings: r.servings,
      }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      hasAI={hasAI}
    />
  );
}
