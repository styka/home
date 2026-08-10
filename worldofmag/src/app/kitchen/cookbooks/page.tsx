export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getCookbooks } from "@/modules/kitchen/actions/cookbooks";
import { CookbookList } from "@/modules/kitchen/ui/cookbooks/CookbookList";

export default async function KitchenCookbooksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const cookbooks = await getCookbooks();

  return <CookbookList cookbooks={cookbooks} />;
}
