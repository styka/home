export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import portfelModule from "@/modules/portfel/module";
import { getMonthlyReport } from "@/modules/portfel/actions/portfelReports";
import { MonthlyReportPage } from "@/modules/portfel/ui/MonthlyReportPage";

export default async function PortfelReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, portfelModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const initial = await getMonthlyReport(0);
  return <MonthlyReportPage initial={initial} />;
}
