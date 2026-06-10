export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCookbooks } from "@/actions/cookbooks";
import { RecipeEditor } from "@/components/kitchen/recipes/RecipeEditor";
import { RecipeImportReview } from "@/components/kitchen/recipes/RecipeImportReview";

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
