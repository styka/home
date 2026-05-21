export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecipes } from "@/actions/recipes";
import { getCookbooks } from "@/actions/cookbooks";
import { getTags } from "@/actions/tags";
import { RecipeList } from "@/components/kitchen/recipes/RecipeList";

export default async function KitchenRecipesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [recipes, cookbooks, tags] = await Promise.all([
    getRecipes(),
    getCookbooks(),
    getTags(),
  ]);
  const hasAI = session.user.permissions?.includes("kitchen.ai") ?? false;

  return (
    <RecipeList
      recipes={recipes}
      tags={tags}
      cookbooks={cookbooks.map((cb) => ({ id: cb.id, name: cb.name, emoji: cb.emoji }))}
      hasAI={hasAI}
    />
  );
}
