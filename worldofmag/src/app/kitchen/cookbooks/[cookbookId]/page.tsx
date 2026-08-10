export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getCookbook } from "@/modules/kitchen/actions/cookbooks";
import { getRecipes } from "@/modules/kitchen/actions/recipes";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { CookbookView } from "@/modules/kitchen/ui/cookbooks/CookbookView";

interface PageProps {
  params: { cookbookId: string };
}

export default async function CookbookDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const cookbook = await getCookbook(params.cookbookId);
  if (!cookbook) notFound();

  const teamIds = await getUserTeamIds(session.user.id);
  const canEdit =
    cookbook.ownerId === session.user.id ||
    (cookbook.ownerTeamId != null && teamIds.includes(cookbook.ownerTeamId));

  const recipes = await getRecipes({ cookbookId: cookbook.id });

  return <CookbookView cookbook={cookbook} recipes={recipes} canEdit={canEdit} />;
}
