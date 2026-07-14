export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getAuditLog } from "@/actions/access";
import { AuditLogPage } from "@/components/admin/AuditLogPage";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const page = await getAuditLog();
  return <AuditLogPage page={page} />;
}
