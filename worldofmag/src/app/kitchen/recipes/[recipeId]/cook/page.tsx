export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecipe } from "@/actions/recipes";
import { CookMode } from "@/components/kitchen/recipes/CookMode";

interface PageProps {
  params: { recipeId: string };
}

export default async function CookModePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const recipe = await getRecipe(decodeURIComponent(params.recipeId));
  if (!recipe) notFound();

  return <CookMode recipe={recipe} />;
}
