export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCookbooks } from "@/actions/cookbooks";
import { RecipeEditor } from "@/components/kitchen/recipes/RecipeEditor";

export default async function NewRecipePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const cookbooks = await getCookbooks();
  const hasAI = session.user.permissions?.includes("kitchen.ai") ?? false;

  return (
    <RecipeEditor
      cookbooks={cookbooks.map((cb) => ({ id: cb.id, name: cb.name, emoji: cb.emoji }))}
      hasAI={hasAI}
    />
  );
}
