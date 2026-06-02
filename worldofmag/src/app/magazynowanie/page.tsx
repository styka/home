export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getStorageItems, getLowStock } from "@/actions/storage";
import { getLists } from "@/actions/lists";
import { StorageList } from "@/components/magazynowanie/StorageList";

export default async function MagazynowaniePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.MAGAZYNOWANIE) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [items, lowStock, lists] = await Promise.all([getStorageItems(), getLowStock(), getLists()]);

  return (
    <StorageList
      items={items}
      lowStock={lowStock}
      shoppingLists={lists.map((l) => ({ id: l.id, name: l.name }))}
    />
  );
}
