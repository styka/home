export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCookbook } from "@/actions/cookbooks";
import { getRecipes } from "@/actions/recipes";
import { getUserTeamIds } from "@/lib/server-utils";
import { CookbookView } from "@/components/kitchen/cookbooks/CookbookView";

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
