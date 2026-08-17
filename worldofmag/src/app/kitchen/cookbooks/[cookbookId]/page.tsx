export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getCookbook } from "@/modules/kitchen/actions/cookbooks";
import { getRecipes } from "@/modules/kitchen/actions/recipes";
import { getAccessContext } from "@/platform/sharing/cache";
import { CookbookView } from "@/modules/kitchen/ui/cookbooks/CookbookView";

interface PageProps {
  params: { cookbookId: string };
}

export default async function CookbookDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const cookbook = await getCookbook(params.cookbookId);
  if (!cookbook) notFound();

  // 079: „mogę edytować" = zasób leży w jednej z MOICH przestrzeni. Dawny warunek („mój lub
  // mojego zespołu") przekłada się na to jeden do jednego przez lustro z zadania 9.
  const mojePrzestrzenie = (await getAccessContext(session.user.id)).workspaceIds;
  const canEdit = mojePrzestrzenie.includes(cookbook.workspaceId);

  const recipes = await getRecipes({ cookbookId: cookbook.id });

  return <CookbookView cookbook={cookbook} recipes={recipes} canEdit={canEdit} />;
}
