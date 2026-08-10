export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getRecipe, assertRecipeAccess } from "@/modules/kitchen/actions/recipes";
import { getCookbooks } from "@/modules/kitchen/actions/cookbooks";
import { RecipeEditor } from "@/modules/kitchen/ui/recipes/RecipeEditor";

interface PageProps {
  params: { recipeId: string };
}

export default async function EditRecipePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const recipe = await getRecipe(decodeURIComponent(params.recipeId));
  if (!recipe) notFound();
  await assertRecipeAccess(recipe.id, session.user.id, "edit");

  const cookbooks = await getCookbooks();
  const hasAI = session.user.permissions?.includes("kitchen.ai") ?? false;

  return (
    <RecipeEditor
      recipe={recipe}
      cookbooks={cookbooks.map((cb) => ({ id: cb.id, name: cb.name, emoji: cb.emoji }))}
      hasAI={hasAI}
    />
  );
}
