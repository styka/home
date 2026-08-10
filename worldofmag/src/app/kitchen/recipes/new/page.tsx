export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getCookbooks } from "@/modules/kitchen/actions/cookbooks";
import { RecipeEditor } from "@/modules/kitchen/ui/recipes/RecipeEditor";
import { RecipeImportReview } from "@/modules/kitchen/ui/recipes/RecipeImportReview";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams?: { import?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const cookbooks = await getCookbooks();
  const hasAI = session.user.permissions?.includes("kitchen.ai") ?? false;
  const cbList = cookbooks.map((cb) => ({ id: cb.id, name: cb.name, emoji: cb.emoji }));

  // K5: po imporcie (OCR/URL/AI) otwórz ekran rewizji ze szkicem z sessionStorage.
  if (searchParams?.import === "1") {
    return <RecipeImportReview cookbooks={cbList} hasAI={hasAI} />;
  }

  return <RecipeEditor cookbooks={cbList} hasAI={hasAI} />;
}
