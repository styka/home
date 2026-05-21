export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecipe } from "@/actions/recipes";
import { getLists } from "@/actions/lists";
import { getUserTeamIds } from "@/lib/server-utils";
import { RecipeView } from "@/components/kitchen/recipes/RecipeView";

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
