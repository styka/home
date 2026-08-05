export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getSystemHealth } from "@/actions/systemHealth";
import { SystemHealthPage } from "@/components/admin/SystemHealthPage";

export default async function AdminHealthPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const health = await getSystemHealth();
  return <SystemHealthPage health={health} />;
}
