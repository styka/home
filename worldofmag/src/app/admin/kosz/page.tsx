export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getAdminTrash } from "@/actions/adminTrash";
import { KoszAdmina } from "@/components/admin/KoszAdmina";

export default async function AdminKoszPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const page = await getAdminTrash();
  return <KoszAdmina initial={page} />;
}
