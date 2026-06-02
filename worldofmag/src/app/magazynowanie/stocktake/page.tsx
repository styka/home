export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getStorageItems } from "@/actions/storage";
import { StockTakeMode } from "@/components/magazynowanie/StockTakeMode";

export default async function StorageStocktakePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.MAGAZYNOWANIE) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const items = await getStorageItems();
  return <StockTakeMode items={items} />;
}
