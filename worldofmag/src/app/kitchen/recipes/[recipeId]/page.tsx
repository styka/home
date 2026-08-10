export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getRecipe } from "@/modules/kitchen/actions/recipes";
import { getLists } from "@/actions/lists";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { RecipeView } from "@/modules/kitchen/ui/recipes/RecipeView";

interface PageProps {
  params: { recipeId: string };
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const recipe = await getRecipe(decodeURIComponent(params.recipeId));
  if (!recipe) notFound();

  const teamIds = await getUserTeamIds(session.user.id);
  const canEdit =
    recipe.ownerId === session.user.id ||
    (recipe.ownerTeamId != null && teamIds.includes(recipe.ownerTeamId));

  const lists = await getLists();

  return (
    <RecipeView
      recipe={recipe}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      canEdit={canEdit}
    />
  );
}
