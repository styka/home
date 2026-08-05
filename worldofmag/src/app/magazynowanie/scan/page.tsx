export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import magazynowanieModule from "@/modules/magazynowanie/module";
import { StorageScan } from "@/modules/magazynowanie/ui/StorageScan";

export default async function StorageScanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, magazynowanieModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  return <StorageScan />;
}
