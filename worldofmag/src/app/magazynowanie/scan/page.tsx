export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { StorageScan } from "@/components/magazynowanie/StorageScan";

export default async function StorageScanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.MAGAZYNOWANIE) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  return <StorageScan />;
}
