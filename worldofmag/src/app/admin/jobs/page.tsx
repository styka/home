export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getJobsOverview } from "@/actions/jobs";
import { AdminJobsPage } from "@/components/admin/AdminJobsPage";

export default async function AdminJobsRoute() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const initial = await getJobsOverview("ALL");
  return <AdminJobsPage initial={initial} />;
}
