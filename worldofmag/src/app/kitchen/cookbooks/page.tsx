export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCookbooks } from "@/actions/cookbooks";
import { CookbookList } from "@/components/kitchen/cookbooks/CookbookList";

export default async function KitchenCookbooksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const cookbooks = await getCookbooks();

  return <CookbookList cookbooks={cookbooks} />;
}
