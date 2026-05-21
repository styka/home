import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPantry } from "@/actions/pantry";
import { getRecipes } from "@/actions/recipes";

interface Suggestion {
  recipeId: string;
  slug: string;
  title: string;
  reason: string;
  matchedIngredients: string[];
}

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pantry, recipes] = await Promise.all([getPantry(), getRecipes()]);
  if (pantry.length === 0 || recipes.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const pantryNames = pantry
    .filter((p) => (p.quantity ?? 0) > 0)
    .map((p) => (p.product?.name ?? p.name).toLowerCase());

  // Quick rule-based pre-filter — find recipes with highest overlap of ingredients with pantry.
  const fullRecipes = await prisma.recipe.findMany({
    where: { id: { in: recipes.slice(0, 50).map((r) => r.id) } },
    include: { ingredients: { include: { product: true } } },
  });

  type Scored = { recipe: typeof fullRecipes[number]; matched: string[]; score: number };
  const scored: Scored[] = fullRecipes.map((r) => {
    const ingNames = r.ingredients.map((i) => (i.product?.name ?? i.name).toLowerCase());
    const matched = ingNames.filter((n) => pantryNames.some((p) => n.includes(p) || p.includes(n)));
    const score = r.ingredients.length > 0 ? matched.length / r.ingredients.length : 0;
    return { recipe: r, matched, score };
  });

  const top = scored
    .filter((s) => s.matched.length > 0)
    .sort((a, b) => b.score - a.score || b.matched.length - a.matched.length)
    .slice(0, 5);

  const suggestions: Suggestion[] = top.map((s) => ({
    recipeId: s.recipe.id,
    slug: s.recipe.slug,
    title: s.recipe.title,
    reason: `Masz ${s.matched.length} z ${s.recipe.ingredients.length} składników`,
    matchedIngredients: s.matched.slice(0, 5),
  }));

  return NextResponse.json({ suggestions });
}
