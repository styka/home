import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getListSummaries } from "@/actions/lists";
import { ShoppingHomePage } from "@/components/shopping/ShoppingHomePage";

export const dynamic = "force-dynamic";

export default async function ShoppingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [lists, archived] = await Promise.all([
    getListSummaries(false),
    getListSummaries(true),
  ]);

  return <ShoppingHomePage lists={lists} archivedLists={archived} />;
}
