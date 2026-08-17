export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getRecipe } from "@/modules/kitchen/actions/recipes";
import { getLists } from "@/modules/shopping/contract";
import { getAccessContext } from "@/platform/sharing/cache";
import { RecipeView } from "@/modules/kitchen/ui/recipes/RecipeView";

interface PageProps {
  params: { recipeId: string };
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const recipe = await getRecipe(decodeURIComponent(params.recipeId));
  if (!recipe) notFound();

  // 079: „mogę edytować" = zasób leży w jednej z MOICH przestrzeni. Dawny warunek („mój lub
  // mojego zespołu") przekłada się na to jeden do jednego przez lustro z zadania 9.
  const mojePrzestrzenie = (await getAccessContext(session.user.id)).workspaceIds;
  const canEdit = mojePrzestrzenie.includes(recipe.workspaceId);

  const lists = await getLists();

  return (
    <RecipeView
      recipe={recipe}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      canEdit={canEdit}
    />
  );
}
